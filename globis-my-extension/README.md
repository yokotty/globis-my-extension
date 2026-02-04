# VC Notification Grouper

Groups items on the GLOBIS VC mention/notification list by the class name shown in each item.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked".
4. Select this folder: `vc-extension`.

## Notes

- The grouping key is the bold class name inside the notification text.
- If the list updates via infinite scroll, the observer re-groups automatically.
