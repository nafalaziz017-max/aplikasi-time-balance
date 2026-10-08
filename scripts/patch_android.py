"""Menambah izin & orientasi portrait di AndroidManifest.xml"""
import re
P = "android/app/src/main/AndroidManifest.xml"
s = open(P, encoding="utf-8").read()
perms = ["android.permission.POST_NOTIFICATIONS", "android.permission.VIBRATE", "android.permission.WAKE_LOCK", "android.permission.RECEIVE_BOOT_COMPLETED"]
add = "".join(f'    <uses-permission android:name="{p}" />\n' for p in perms if p not in s)
s = s.replace("</manifest>", add + "</manifest>")
if "screenOrientation" not in s:
    s = re.sub(r"(<activity\b)", r'\1 android:screenOrientation="portrait"', s, count=1)
open(P, "w", encoding="utf-8").write(s)
print("Manifest dipatch")
