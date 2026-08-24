import urllib.request
import base64
import csv
import subprocess
import time
import sys
import os

VPN_GATE_API = "http://www.vpngate.net/api/iphone/"

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

    # スピード・スコア順にソート
    servers.sort(key=lambda x: (x["score"], x["speed"]), reverse=True)
    print(f"✅ {len(servers)} 件の日本VPNサーバーが見つかりました。")
    return servers

def try_connect_vpn(servers):
    ovpn_file = "/tmp/vpngate.ovpn" if os.name != "nt" else "vpngate.ovpn"
    
    for i, s in enumerate(servers[:10]):
        print(f"\n🔄 [{i+1}/10] VPNサーバー {s['ip']} への接続を試行中...")
        try:
            config_data = base64.b64decode(s["config"]).decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"   設定のデコードエラー: {e}")
            continue

        # IPv6や一部の競合オプションを調整
        config_lines = []
        for line in config_data.split("\n"):
            if line.strip().startswith("proto ") or line.strip().startswith("remote ") or line.strip().startswith("cipher ") or line.strip().startswith("auth "):
                config_lines.append(line)
            elif not (line.strip().startswith("block-outside-dns") or line.strip().startswith("redirect-gateway-bypass")):
                config_lines.append(line)

        # Linux用オプション
        if os.name != "nt":
            config_lines.append("redirect-gateway def1")
            config_lines.append("dhcp-option DNS 8.8.8.8")

        with open(ovpn_file, "w", encoding="utf-8") as f:
            f.write("\n".join(config_lines))

        # OpenVPN プロセス起動
        cmd = ["sudo", "openvpn", "--config", ovpn_file, "--daemon", "--writepid", "/tmp/openvpn.pid"]
        try:
            # 既存のopenvpnがあれば停止
            subprocess.run(["sudo", "killall", "openvpn"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            time.sleep(1)

            subprocess.run(cmd, check=True)
            print("   接続待機中 (最大12秒)...")

            # 接続完了待ち（IP確認）
            for _ in range(12):
                time.sleep(1)
                try:
                    res = urllib.request.urlopen("https://ifconfig.me/ip", timeout=3)
                    new_ip = res.read().decode().strip()
                    if new_ip:
                        print(f"🎉 日本VPN経由での接続に成功しました！ 現在のIP: {new_ip}")
                        return True
                except Exception:
                    pass

            print("   ⚠️ タイムアウト: 接続が確立しませんでした。")
        except Exception as e:
            print(f"   ❌ OpenVPN起動エラー: {e}")

    return False

if __name__ == "__main__":
    if os.name == "nt":
        print("⚠️ このスクリプトは GitHub Actions (Linux) 用です。")
        sys.exit(0)

    servers = get_japan_servers()
    if not servers:
        print("❌ 利用可能な日本VPNサーバーが見つかりませんでした。")
        sys.exit(1)

    success = try_connect_vpn(servers)
    if not success:
        print("❌ 日本VPNへの接続に失敗しました。")
        sys.exit(1)
