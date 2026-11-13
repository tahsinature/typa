use objc2::{define_class, msg_send, rc::Retained, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSBackingStoreType, NSEvent, NSEventModifierFlags, NSWindow, NSWindowStyleMask,
};
use objc2_foundation::{NSPoint, NSRect, NSSize};

define_class!(
    #[unsafe(super(NSWindow))]
    #[thread_kind = MainThreadOnly]
    struct PreferencesWindow;

    impl PreferencesWindow {
        // The editor uses Cmd+W for tabs, so its menu has no Close Window item.
        // Handle the standard window shortcut here without changing editor shortcuts.
        #[unsafe(method(performKeyEquivalent:))]
        fn perform_key_equivalent(&self, event: &NSEvent) -> bool {
            if event.modifierFlags().contains(NSEventModifierFlags::Command)
                && event.charactersIgnoringModifiers().is_some_and(|key| key.to_string() == "w")
            {
                self.performClose(None);
                true
            } else {
                // Preserve AppKit's normal handling for all other key equivalents.
                unsafe { msg_send![super(self), performKeyEquivalent: event] }
            }
        }
    }
);

pub fn create(mtm: MainThreadMarker) -> Retained<NSWindow> {
    // Only titled and closable: resizing, fullscreen and minimizing are disabled.
    let window: Retained<PreferencesWindow> = unsafe {
        msg_send![PreferencesWindow::alloc(mtm),
            initWithContentRect: NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(640.0, 400.0)),
            styleMask: (NSWindowStyleMask::Titled | NSWindowStyleMask::Closable),
            backing: NSBackingStoreType::Buffered,
            defer: false
        ]
    };
    window.into_super()
}
