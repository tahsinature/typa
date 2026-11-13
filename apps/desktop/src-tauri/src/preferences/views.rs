//! Standard AppKit controls, positioned within a fixed-size preferences pane.
use super::macos::PreferencesController;
use crate::preferences_settings::Preferences;
use objc2::{rc::Retained, sel, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSButton, NSColor, NSFont, NSPopUpButton, NSTextAlignment, NSTextField, NSView,
};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};

fn frame(x: f64, y: f64, width: f64, height: f64) -> NSRect {
    NSRect::new(NSPoint::new(x, y), NSSize::new(width, height))
}

fn label(view: &NSView, text: &str, rect: NSRect, secondary: bool, mtm: MainThreadMarker) {
    let label = NSTextField::labelWithString(&NSString::from_str(text), mtm);
    label.setFrame(rect);
    label.setFont(Some(&NSFont::systemFontOfSize(if secondary {
        11.0
    } else {
        13.0
    })));
    if secondary {
        label.setTextColor(Some(&NSColor::secondaryLabelColor()));
    }
    view.addSubview(&label);
}

fn row_label(view: &NSView, text: &str, y: f64, mtm: MainThreadMarker) {
    let label = NSTextField::labelWithString(&NSString::from_str(text), mtm);
    label.setFrame(frame(35.0, y, 175.0, 22.0));
    label.setAlignment(NSTextAlignment::Right);
    view.addSubview(&label);
}

fn popup(
    view: &NSView,
    controller: &PreferencesController,
    title: &str,
    options: &[&str],
    selected: usize,
    tag: isize,
    y: f64,
) {
    let mtm = controller.mtm();
    row_label(view, title, y, mtm);
    let control = NSPopUpButton::initWithFrame_pullsDown(
        NSPopUpButton::alloc(mtm),
        frame(224.0, y - 2.0, 226.0, 27.0),
        false,
    );
    for option in options {
        control.addItemWithTitle(&NSString::from_str(option));
    }
    control.selectItemAtIndex(selected as isize);
    control.setTag(tag);
    // Each control is retained by its parent view; the main-thread controller owns its target.
    unsafe {
        control.setTarget(Some(controller));
        control.setAction(Some(sel!(changePopup:)));
    }
    view.addSubview(&control);
}

pub fn pane(
    controller: &PreferencesController,
    pane: usize,
    settings: &Preferences,
) -> Retained<NSView> {
    let mtm = controller.mtm();
    let view = NSView::initWithFrame(NSView::alloc(mtm), frame(0.0, 0.0, 640.0, 400.0));
    match pane {
        0 => general(&view, controller, settings),
        1 => appearance(&view, controller, settings),
        _ => shortcuts(&view, mtm),
    }
    label(
        &view,
        "Changes are saved automatically.",
        frame(224.0, 24.0, 330.0, 18.0),
        true,
        mtm,
    );
    view
}

fn general(view: &NSView, controller: &PreferencesController, settings: &Preferences) {
    let mtm = controller.mtm();
    popup(
        view,
        controller,
        "Pane layout:",
        &["Side by side", "Stacked"],
        usize::from(settings.layout == "vertical"),
        0,
        324.0,
    );
    label(
        view,
        "Arrange your input and output panes.",
        frame(226.0, 294.0, 350.0, 20.0),
        true,
        mtm,
    );
    row_label(view, "Sidebar:", 246.0, mtm);
    let checkbox = unsafe {
        NSButton::checkboxWithTitle_target_action(
            &NSString::from_str("Show saved files"),
            Some(controller),
            Some(sel!(changeSidebar:)),
            mtm,
        )
    };
    checkbox.setFrame(frame(224.0, 246.0, 280.0, 22.0));
    checkbox.setState(isize::from(settings.sidebar_open));
    view.addSubview(&checkbox);
    label(
        view,
        "Preferences apply to all open Typa windows.",
        frame(226.0, 214.0, 365.0, 20.0),
        true,
        mtm,
    );
}

fn appearance(view: &NSView, controller: &PreferencesController, settings: &Preferences) {
    let theme = match settings.theme.as_str() {
        "light" => 1,
        "dark" => 2,
        _ => 0,
    };
    popup(
        view,
        controller,
        "Appearance:",
        &["System", "Light", "Dark"],
        theme,
        1,
        324.0,
    );
    let sizes: Vec<String> = (8..=32).map(|size| format!("{size} px")).collect();
    let options: Vec<&str> = sizes.iter().map(String::as_str).collect();
    popup(
        view,
        controller,
        "Editor text size:",
        &options,
        (settings.font_size - 8) as usize,
        2,
        254.0,
    );
    label(
        view,
        "Default: 13 px. Use ⌘+ and ⌘− while you work.",
        frame(226.0, 224.0, 365.0, 20.0),
        true,
        controller.mtm(),
    );
    let palette = match settings.palette_style.as_str() {
        "linear" => 1,
        "arc" => 2,
        _ => 0,
    };
    popup(
        view,
        controller,
        "Command palette:",
        &["Raycast", "Linear", "Arc"],
        palette,
        3,
        164.0,
    );
    label(
        view,
        "Choose how the transform picker looks.",
        frame(226.0, 134.0, 365.0, 20.0),
        true,
        controller.mtm(),
    );
}

fn shortcuts(view: &NSView, mtm: MainThreadMarker) {
    // Standard labels keep the key glyphs and text aligned with native preferences.
    let groups: Vec<ShortcutGroup> =
        serde_json::from_str(include_str!("../../../src/lib/shortcuts.json"))
            .expect("bundled keyboard shortcuts are valid JSON");
    for (index, group) in groups.iter().enumerate() {
        let x = if index % 2 == 0 { 42.0 } else { 338.0 };
        let y = if index < 2 { 350.0 } else { 162.0 };
        let heading = NSTextField::labelWithString(&NSString::from_str(&group.label), mtm);
        heading.setFont(Some(&NSFont::boldSystemFontOfSize(13.0)));
        heading.setFrame(frame(x, y, 220.0, 22.0));
        view.addSubview(&heading);
        for (row, shortcut) in group.shortcuts.iter().enumerate() {
            let y = y - 29.0 - row as f64 * 25.0;
            label(view, &shortcut.action, frame(x, y, 180.0, 22.0), false, mtm);
            label(
                view,
                &shortcut.keys,
                frame(x + 185.0, y, 75.0, 22.0),
                true,
                mtm,
            );
        }
    }
}

#[derive(serde::Deserialize)]
struct ShortcutGroup {
    label: String,
    shortcuts: Vec<Shortcut>,
}

#[derive(serde::Deserialize)]
struct Shortcut {
    action: String,
    keys: String,
}
