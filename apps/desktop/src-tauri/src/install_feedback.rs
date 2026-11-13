//! Native installation feedback. AppKit objects stay on the main thread.

#[cfg(target_os = "macos")]
mod macos {
    use objc2::{rc::Retained, MainThreadMarker, MainThreadOnly};
    use objc2_app_kit::{
        NSBackingStoreType, NSColor, NSFont, NSPanel, NSProgressIndicator,
        NSProgressIndicatorStyle, NSTextField, NSWindowStyleMask,
    };
    use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
    use std::cell::RefCell;

    thread_local! {
        static PANEL: RefCell<Option<Retained<NSPanel>>> = const { RefCell::new(None) };
    }

    pub fn show() {
        let main_thread = MainThreadMarker::new().expect("installation panel runs on main thread");
        let panel = NSPanel::initWithContentRect_styleMask_backing_defer(
            NSPanel::alloc(main_thread),
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(380.0, 132.0)),
            NSWindowStyleMask::Titled,
            NSBackingStoreType::Buffered,
            false,
        );
        panel.setTitle(&NSString::from_str("Typa Update"));
        panel.setFloatingPanel(true);
        panel.setHidesOnDeactivate(false);

        let content = panel.contentView().expect("panel has a content view");
        let spinner = NSProgressIndicator::initWithFrame(
            NSProgressIndicator::alloc(main_thread),
            NSRect::new(NSPoint::new(28.0, 52.0), NSSize::new(32.0, 32.0)),
        );
        spinner.setStyle(NSProgressIndicatorStyle::Spinning);
        spinner.setIndeterminate(true);
        content.addSubview(&spinner);
        // No action sender is needed for this indeterminate indicator.
        unsafe { spinner.startAnimation(None) };

        let title =
            NSTextField::labelWithString(&NSString::from_str("Installing update…"), main_thread);
        title.setFont(Some(&NSFont::boldSystemFontOfSize(15.0)));
        title.setFrame(NSRect::new(
            NSPoint::new(80.0, 72.0),
            NSSize::new(280.0, 22.0),
        ));
        content.addSubview(&title);

        let detail = NSTextField::labelWithString(
            &NSString::from_str("Typa will restart shortly."),
            main_thread,
        );
        detail.setFont(Some(&NSFont::systemFontOfSize(13.0)));
        detail.setTextColor(Some(&NSColor::secondaryLabelColor()));
        detail.setFrame(NSRect::new(
            NSPoint::new(80.0, 46.0),
            NSSize::new(280.0, 20.0),
        ));
        content.addSubview(&detail);

        panel.center();
        panel.makeKeyAndOrderFront(None);
        PANEL.with(|slot| *slot.borrow_mut() = Some(panel));
    }

    pub fn dismiss() {
        PANEL.with(|slot| {
            if let Some(panel) = slot.borrow_mut().take() {
                panel.orderOut(None);
            }
        });
    }
}

pub fn show(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    app.run_on_main_thread(macos::show)
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn dismiss(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    if let Err(error) = app.run_on_main_thread(macos::dismiss) {
        eprintln!("could not dismiss installation feedback: {error}");
    }
}
