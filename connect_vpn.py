import urllib.request
import base64
import csv
import subprocess
import time
import sys
import os
import socket

VPN_GATE_API = "http://www.vpngate.net/api/iphone/"
TARGET_HOST = "shifucon.ppihgroup.com"

def get_target_ip():
    try:
        ip = socket.gethostbyname(TARGET_HOST)
        print(f"🎯 対象サーバー: {TARGET_HOST} -> {ip}")
        return ip
    except Exception as e:
        print(f"⚠️ DNS解決失敗: {e}, デフォルトIPを使用します")
        return "220.100.235.20"

def get_japan_servers():
    print("📡 VPN Gateから日本のサーバーリストを取得中...")
    req = urllib.request.Request(VPN_GATE_API, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            content = res.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"❌ VPN Gateの取得に失敗しました: {e}")
        return []

    lines = [line.strip() for line in content.split("\n") if line.strip()]
    servers = []
    for row in csv.reader(lines):
        if len(row) > 14 and len(row) > 6:
            country = row[6]
            if country.upper() == "JP" and row[14]:
                try:
                    score = int(row[2]) if row[2].isdigit() else 0
                    speed = int(row[4]) if row[4].isdigit() else 0
                    config_b64 = row[14]
                    ip = row[1]
                    servers.append({
                        "ip": ip,
                        "score": score,
                        "speed": speed,
                        "config": config_b64
                    })
                except Exception:
                    continue

    # スコア・スピード順にソート
    servers.sort(key=lambda x: (x["score"], x["speed"]), reverse=True)
    print(f"✅ {len(servers)} 件の日本VPNサーバーが見つかりました。")
    return servers

def try_connect_vpn(servers, target_ip):
    ovpn_file = "/tmp/vpngate.ovpn" if os.name != "nt" else "vpngate.ovpn"
    
    for i, s in enumerate(servers[:6]):
        print(f"\n🔄 [{i+1}/6] 日本VPNサーバー {s['ip']} (スコア:{s['score']}) への接続を試行中...")
        try:
            config_data = base64.b64decode(s["config"]).decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"   設定デコードエラー: {e}")
            continue

        config_lines = []
        for line in config_data.split("\n"):
            line_str = line.strip()
            if any(line_str.startswith(opt) for opt in ["redirect-gateway", "block-outside-dns", "dhcp-option", "route-gateway"]):
                continue
            config_lines.append(line)

        # Split-Tunneling 設定（対象のシフトサーバー通信のみVPN経由にする）
        if os.name != "nt":
            config_lines.append("route-nopull")
            config_lines.append(f"route {target_ip} 255.255.255.255")

        with open(ovpn_file, "w", encoding="utf-8") as f:
            f.write("\n".join(config_lines))

        # OpenVPN 起動
        cmd = ["sudo", "openvpn", "--config", ovpn_file, "--daemon", "--writepid", "/tmp/openvpn.pid"]
        try:
            subprocess.run(["sudo", "killall", "openvpn"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            time.sleep(1)

            subprocess.run(cmd, check=True)
            print("   トンネル確立確認中 (最大6秒)...")

            # 対象サイトへのアクセスをテスト (タイムアウト4秒)
            for attempt in range(6):
                time.sleep(1)
                test_cmd = ["curl", "-s", "--max-time", "4", "-o", "/dev/null", "-w", "%{http_code}", f"https://{TARGET_HOST}/staffpage/"]
                res = subprocess.run(test_cmd, capture_output=True, text=True)
                code = res.stdout.strip()
                if code in ["200", "302"]:
                    print(f"🎉 日本VPN経由でのシフトサイト接続に成功しました！ (Status: {code})")
                    return True
                elif code == "403":
                    print(f"   ⚠️ 403 Forbidden (このVPNサーバーはブロックされています)")
                    break

            print("   ⚠️ 接続確立タイムアウト。次のサーバーを試します。")
        except Exception as e:
            print(f"   ❌ エラー: {e}")

    return False

if __name__ == "__main__":
    if os.name == "nt":
        print("⚠️ このスクリプトは GitHub Actions (Linux) 用です。")
        sys.exit(0)

    target_ip = get_target_ip()
    servers = get_japan_servers()
    if not servers:
        print("❌ 利用可能な日本VPNサーバーが見つかりませんでした。")
        sys.exit(1)

    success = try_connect_vpn(servers, target_ip)
    if not success:
        print("❌ 日本VPNへの接続に失敗しました。")
        sys.exit(1)
