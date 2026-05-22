#include <Mouse.h>

void setup() {
  // PCとのシリアル通信を開始（ボーレートはPython側と合わせる）
  Serial.begin(115200);
  // マウスとしての動作を開始
  Mouse.begin();
}

void loop() {
  // PC（Python）からデータが送られてきたかチェック
  if (Serial.available() > 0) {
    // 改行コードまで読み込む（例: "10,-5\n"）
    String data = Serial.readStringUntil('\n');
    
    int commaIndex = data.indexOf(',');
    if (commaIndex > 0) {
      String xStr = data.substring(0, commaIndex);
      String yStr = data.substring(commaIndex + 1);
      
      int dx = xStr.toInt();
      int dy = yStr.toInt();
      
      // USB HIDの仕様上、1回の移動量は -127 から 127 の間にする必要がある
      dx = constrain(dx, -127, 127);
      dy = constrain(dy, -127, 127);
      
      // マウスを動かす
      Mouse.move(dx, dy, 0);
    }
  }
}
