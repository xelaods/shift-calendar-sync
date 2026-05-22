import tkinter as tk
import threading
import cv2
import dxcam
import numpy as np
from ultralytics import YOLO
import contextlib
import os
import sys
import logging
import win32api
import win32con
import time
import ctypes
from ctypes import wintypes
import torch

# ===== シリアル通信によるマウス移動（RP2350等の外部ハードウェア対応） =====
import serial
import serial.tools.list_ports

# シリアルポートの設定（RP2350が接続されているCOMポートを指定します）
SERIAL_PORT = "COM3"  # ※後でRP2350の実際のポート番号に書き換えます
BAUD_RATE = 115200
arduino_serial = None

def init_serial():
    global arduino_serial
    try:
        arduino_serial = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
        print(f"✅ RP2350とのシリアル通信を開始しました: {SERIAL_PORT}")
    except Exception as e:
        print(f"⚠️ シリアル通信エラー: {e}")
        print(f"RP2350が {SERIAL_PORT} に接続されているか、ポート番号が合っているか確認してください。")

init_serial()

def send_mouse_move(dx, dy):
    """外付けデバイス（RP2350等）にシリアル通信で移動量(dx, dy)を送信"""
    if arduino_serial is not None and arduino_serial.is_open:
        try:
            # dx, dy をカンマ区切りで送信 (例: "10,-5\n")
            data = f"{int(dx)},{int(dy)}\n"
            arduino_serial.write(data.encode('utf-8'))
        except Exception as e:
            print(f"⚠️ シリアル送信エラー: {e}")

# ultralytics のログをエラーのみ表示して、余計な出力を抑える
logging.getLogger("ultralytics").setLevel(logging.ERROR)

@contextlib.contextmanager
def suppress_stdout():
    with open(os.devnull, "w") as devnull:
        old_stdout = sys.stdout
        sys.stdout = devnull
        try:
            yield
        finally:
            sys.stdout = old_stdout

# プログラムの実行状態を管理するフラグ
running = False

def is_rmb_pressed():
    return win32api.GetKeyState(win32con.VK_RBUTTON) < 0

def movement_thread_func(x, y, smoothness):
    # GetCursorPos を使わず、目標差分を直接ステップ分割して送信
    # （フルスクリーンゲームではカーソル座標がロックされるため）
    steps = max(smoothness, 1)

    # 1ステップあたりの移動量（1.2で割って緩やか）
    delta_x = (x / steps) / 1.2
    delta_y = (y / steps) / 1.2

    # 移動量が大きすぎる場合はスキップ（誤検出対策）
    if abs(x) + abs(y) > 1200:
        return

    for _ in range(steps):
        rand_x = np.random.randint(-1, 2)
        rand_y = np.random.randint(-1, 2)
        dx = int(delta_x) + rand_x
        dy = int(delta_y) + rand_y
        send_mouse_move(dx, dy)
        time.sleep(0.005)

def movement(x, y, smoothness):
    threading.Thread(target=movement_thread_func, args=(x, y, smoothness)).start()

def start_detection(model_path, smoothness):
    global running

    # YOLO モデルの読み込み（CUDA が使えればGPU、なければCPU）
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"🖥️ 使用デバイス: {device}")
    model = YOLO(model_path)
    model.to(device)

    # 画面サイズを取得するために、一時的な Tkinter ウィンドウを生成
    temp_root = tk.Tk()
    screen_width = temp_root.winfo_screenwidth()
    screen_height = temp_root.winfo_screenheight()
    temp_root.destroy()

    # 画面中央の 416x416 ピクセル領域を検出対象として設定
    x = int((screen_width - 416) / 2)
    y = int((screen_height - 416) / 2)
    region = (x, y, x + 416, y + 416)

    # dxcam を用いて指定領域の画面キャプチャを開始
    cam = dxcam.create(output_idx=0, region=region)
    cam.start()

    # OpenCV を用いて検出結果を表示するウィンドウを生成（常に最前面に表示）
    cv2.namedWindow("Detection", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Detection", 300, 300)
    cv2.setWindowProperty("Detection", cv2.WND_PROP_TOPMOST, 1)

    # メインループ: キャプチャ、物体検出、エイムアシスト処理を連続実行
    while running:
        frame = cam.get_latest_frame()
        if frame is None:
            continue

        # キャプチャしたフレームの色空間を BGRA から BGR に変換
        frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

        # 不要な出力を抑制しながら、対象物（クラス 0）を検出
        with suppress_stdout():
            results = model(frame, classes=[0], conf=0.47)

        # 検出結果がある場合の処理
        if results[0].boxes is not None and len(results[0].boxes) > 0:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            classes = results[0].boxes.cls.cpu().numpy()
            confidences = results[0].boxes.conf.cpu().numpy()

            enemy_indices = np.where(classes == 0)[0]

            if len(enemy_indices) > 0:
                centers = []
                for i in enemy_indices:
                    if confidences[i] >= 0.47:
                        x1, y1, x2, y2 = boxes[i]
                        center_x = (x1 + x2) / 2
                        center_y = (y1 + y2) / 2
                        centers.append((center_x, center_y))

                closest_center = None
                min_distance = float('inf')

                # 画面中央（208, 208）に最も近い対象物を探索
                for (cx, cy) in centers:
                    dx_val = cx - 208
                    dy_val = cy - 208
                    distance = dx_val**2 + dy_val**2
                    if distance < min_distance:
                        min_distance = distance
                        closest_center = (cx, cy)

                # 右クリックが押されている場合、エイムアシストでマウス移動を実行
                if is_rmb_pressed() and closest_center is not None:
                    move_dx = closest_center[0] - 208
                    move_dy = closest_center[1] - 208
                    print(f"🎯 エイムアシスト: dx={move_dx:.1f}, dy={move_dy:.1f}")
                    movement(move_dx, move_dy, smoothness)

        # 検出結果を描画したフレームをウィンドウに表示
        annotated_frame = results[0].plot()
        cv2.imshow("Detection", annotated_frame)

        # 'q' キーでループ終了
        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False
            break

    # キャプチャ停止とウィンドウクローズ
    cam.stop()
    cv2.destroyAllWindows()

def on_start():
    global running
    if running:
        return  # すでに実行中の場合は無視
    running = True
    start_button.config(state=tk.DISABLED)
    stop_button.config(state=tk.NORMAL)
    model_path = "semi_fast_legacy.pt"  # legacy モデルのみを使用
    smoothness = smoothness_var.get()
    threading.Thread(target=start_detection, args=(model_path, smoothness), daemon=True).start()

def on_stop():
    global running
    running = False
    start_button.config(state=tk.NORMAL)
    stop_button.config(state=tk.DISABLED)

# Tkinter を用いたシンプルな GUI の設定
root = tk.Tk()
root.title("YOLOv11 検出プログラム with エイムアシスト")

# 使用するモデル（legacy）の情報を表示するラベル
model_info_label = tk.Label(root, text="使用するモデル: legacy")
model_info_label.pack(pady=5)

# マウス移動の滑らかさを調整するスライダー
smoothness_label = tk.Label(root, text="滑らかさ:")
smoothness_label.pack(pady=5)
smoothness_var = tk.IntVar(value=10)
smoothness_scale = tk.Scale(root, from_=1, to=20, orient=tk.HORIZONTAL, variable=smoothness_var)
smoothness_scale.pack(pady=5)

# スタート・ストップのボタン
start_button = tk.Button(root, text="Start", command=on_start)
start_button.pack(pady=5)
stop_button = tk.Button(root, text="Stop", command=on_stop, state=tk.DISABLED)
stop_button.pack(pady=5)

root.mainloop()
