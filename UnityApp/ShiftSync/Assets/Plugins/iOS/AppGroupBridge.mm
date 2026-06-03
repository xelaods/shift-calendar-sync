// AppGroupBridge.mm
// ウィジェットなし版: このファイルは無効化されています。
// WidgetKit を有効化する場合は Unity の Scripting Define Symbols に
// "WIDGET_ENABLED" を追加し、Apple Developer Program の App Groups を有効にしてください。

#ifdef WIDGET_ENABLED

#import <Foundation/Foundation.h>

extern "C" {
    void AppGroup_WriteShiftsJson(const char* json_utf8) {
        if (!json_utf8) return;

        NSString* appGroupID = @"group.com.yourname.shiftsync";
        NSString* json       = [NSString stringWithUTF8String:json_utf8];

        NSUserDefaults* sharedDefaults = [[NSUserDefaults alloc]
                                          initWithSuiteName:appGroupID];
        [sharedDefaults setObject:json forKey:@"today_shifts_json"];
        [sharedDefaults synchronize];

        NSLog(@"[AppGroup] シフトデータを更新しました: %lu 文字",
              (unsigned long)json.length);
    }

    const char* AppGroup_ReadShiftsJson() {
        NSString* appGroupID = @"group.com.yourname.shiftsync";
        NSUserDefaults* sharedDefaults = [[NSUserDefaults alloc]
                                          initWithSuiteName:appGroupID];
        NSString* json = [sharedDefaults stringForKey:@"today_shifts_json"];
        if (!json) return "";
        return [json UTF8String];
    }
}

#endif // WIDGET_ENABLED
