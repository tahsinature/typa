//! App identity inside the shared Preferences window.
use objc2::{rc::Retained, AllocAnyThread, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSColor, NSFont, NSImage, NSImageScaling, NSImageView, NSTextAlignment, NSTextField, NSView,
};
use objc2_foundation::{NSData, NSPoint, NSRect, NSSize, NSString};

fn frame(x: f64, y: f64, width: f64, height: f64) -> NSRect {
    NSRect::new(NSPoint::new(x, y), NSSize::new(width, height))
}

pub fn pane(mtm: MainThreadMarker, version: &str) -> Retained<NSView> {
    let view = NSView::initWithFrame(NSView::alloc(mtm), frame(0.0, 0.0, 640.0, 400.0));
    let icon = NSImageView::initWithFrame(NSImageView::alloc(mtm), frame(272.0, 220.0, 96.0, 96.0));
    let image = NSImage::initWithData(
        NSImage::alloc(),
        &NSData::with_bytes(include_bytes!("../../icons/icon.png")),
    );
    icon.setImage(image.as_deref());
    icon.setImageScaling(NSImageScaling::ScaleProportionallyUpOrDown);
    view.addSubview(&icon);

    let name = NSTextField::labelWithString(&NSString::from_str("Typa"), mtm);
    name.setFrame(frame(40.0, 172.0, 560.0, 32.0));
    name.setAlignment(NSTextAlignment::Center);
    name.setFont(Some(&NSFont::boldSystemFontOfSize(24.0)));
    view.addSubview(&name);

    let version =
        NSTextField::labelWithString(&NSString::from_str(&format!("Version {version}")), mtm);
    version.setFrame(frame(40.0, 142.0, 560.0, 22.0));
    version.setAlignment(NSTextAlignment::Center);
    version.setFont(Some(&NSFont::systemFontOfSize(13.0)));
    version.setTextColor(Some(&NSColor::secondaryLabelColor()));
    view.addSubview(&version);
    view
}
