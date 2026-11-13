//! A retained AppKit pane: progress updates preserve focus and release-note scrolling.
use super::{macos::PreferencesController, update_copy};
use crate::updater::{Phase, Snapshot};
use objc2::{rc::Retained, sel, AllocAnyThread, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSBezelStyle, NSBorderType, NSBox, NSBoxType, NSButton, NSColor,
    NSFont, NSImage, NSImageScaling, NSImageView, NSProgressIndicator, NSProgressIndicatorStyle,
    NSScrollView, NSTextField, NSTextView, NSView,
};
use objc2_foundation::{
    NSData, NSDate, NSDateFormatter, NSDateFormatterStyle, NSPoint, NSRect, NSSize, NSString,
};
use std::{cell::RefCell, time::UNIX_EPOCH};

pub struct UpdatePane {
    pub view: Retained<NSView>,
    checked: Retained<NSTextField>,
    status_icon: Retained<NSImageView>,
    title: Retained<NSTextField>,
    detail: Retained<NSTextField>,
    progress: Retained<NSProgressIndicator>,
    transfer: Retained<NSTextField>,
    notes_title: Retained<NSTextField>,
    notes: Retained<NSTextView>,
    notes_scroll: Retained<NSScrollView>,
    primary: Retained<NSButton>,
    copy: Retained<NSButton>,
    last_notes: RefCell<String>,
}

fn frame(x: f64, y: f64, w: f64, h: f64) -> NSRect {
    NSRect::new(NSPoint::new(x, y), NSSize::new(w, h))
}

fn text(
    view: &NSView,
    rect: NSRect,
    size: f64,
    muted: bool,
    mtm: MainThreadMarker,
) -> Retained<NSTextField> {
    let text = NSTextField::wrappingLabelWithString(&NSString::from_str(""), mtm);
    text.setFrame(rect);
    text.setFont(Some(&NSFont::systemFontOfSize(size)));
    if muted {
        text.setTextColor(Some(&NSColor::secondaryLabelColor()));
    }
    view.addSubview(&text);
    text
}

fn separator(view: &NSView, y: f64, mtm: MainThreadMarker) {
    let line = NSBox::initWithFrame(NSBox::alloc(mtm), frame(40.0, y, 560.0, 1.0));
    line.setBoxType(NSBoxType::Separator);
    view.addSubview(&line);
}

impl UpdatePane {
    pub fn new(controller: &PreferencesController, version: &str) -> Self {
        let mtm = controller.mtm();
        let view = NSView::initWithFrame(NSView::alloc(mtm), frame(0.0, 0.0, 640.0, 400.0));
        let icon =
            NSImageView::initWithFrame(NSImageView::alloc(mtm), frame(42.0, 316.0, 64.0, 64.0));
        let image = NSImage::initWithData(
            NSImage::alloc(),
            &NSData::with_bytes(include_bytes!("../../icons/icon.png")),
        );
        icon.setImage(image.as_deref());
        icon.setImageScaling(NSImageScaling::ScaleProportionallyUpOrDown);
        view.addSubview(&icon);
        let app_name = text(&view, frame(124.0, 350.0, 450.0, 30.0), 23.0, false, mtm);
        app_name.setFont(Some(&NSFont::boldSystemFontOfSize(23.0)));
        app_name.setStringValue(&NSString::from_str("Typa"));
        text(&view, frame(125.0, 327.0, 450.0, 21.0), 13.0, true, mtm)
            .setStringValue(&NSString::from_str(&format!("Version {version}")));
        let checked = text(&view, frame(125.0, 306.0, 470.0, 17.0), 11.0, true, mtm);
        separator(&view, 291.0, mtm);
        let status_icon =
            NSImageView::initWithFrame(NSImageView::alloc(mtm), frame(43.0, 247.0, 26.0, 26.0));
        view.addSubview(&status_icon);
        let title = text(&view, frame(84.0, 250.0, 510.0, 25.0), 16.0, false, mtm);
        title.setFont(Some(&NSFont::boldSystemFontOfSize(16.0)));
        let detail = text(&view, frame(84.0, 211.0, 510.0, 35.0), 12.0, true, mtm);
        let progress = NSProgressIndicator::initWithFrame(
            NSProgressIndicator::alloc(mtm),
            frame(84.0, 193.0, 510.0, 12.0),
        );
        progress.setStyle(NSProgressIndicatorStyle::Bar);
        progress.setMinValue(0.0);
        progress.setMaxValue(100.0);
        view.addSubview(&progress);
        let transfer = text(&view, frame(84.0, 174.0, 510.0, 16.0), 10.0, true, mtm);
        let notes_title = text(&view, frame(43.0, 151.0, 550.0, 20.0), 11.0, false, mtm);
        notes_title.setFont(Some(&NSFont::boldSystemFontOfSize(11.0)));
        let (notes_scroll, notes) = notes_view(&view, mtm);
        // The controller is retained for the window lifetime. These selectors accept NSButton senders.
        let primary = unsafe {
            NSButton::buttonWithTitle_target_action(
                &NSString::from_str("Check for Updates"),
                Some(controller),
                Some(sel!(updateAction:)),
                mtm,
            )
        };
        primary.setBezelStyle(NSBezelStyle::Push);
        primary.setFrame(frame(414.0, 20.0, 184.0, 32.0));
        view.addSubview(&primary);
        let copy = unsafe {
            NSButton::buttonWithTitle_target_action(
                &NSString::from_str("Copy Error Details"),
                Some(controller),
                Some(sel!(copyUpdateError:)),
                mtm,
            )
        };
        copy.setBezelStyle(NSBezelStyle::Push);
        copy.setFrame(frame(414.0, 174.0, 184.0, 26.0));
        view.addSubview(&copy);
        Self {
            view,
            checked,
            status_icon,
            title,
            detail,
            progress,
            transfer,
            notes_title,
            notes,
            notes_scroll,
            primary,
            copy,
            last_notes: RefCell::new(String::new()),
        }
    }

    pub fn update(&self, state: &Snapshot) {
        let content = update_copy::content(state);
        self.title
            .setStringValue(&NSString::from_str(&content.title));
        self.detail
            .setStringValue(&NSString::from_str(content.detail));
        self.primary.setTitle(&NSString::from_str(content.button));
        self.primary.setEnabled(!state.phase.is_busy());
        // Return is a convenient default for checking/downloading, never an accidental restart.
        self.primary.setKeyEquivalent(&NSString::from_str(
            if matches!(
                state.phase,
                Phase::Ready | Phase::Failed(crate::updater::Failure::Install)
            ) {
                ""
            } else {
                "\r"
            },
        ));
        self.status_icon.setImage(
            NSImage::imageWithSystemSymbolName_accessibilityDescription(
                &NSString::from_str(content.symbol),
                Some(&NSString::from_str(&content.title)),
            )
            .as_deref(),
        );
        let tint = match state.phase {
            Phase::UpToDate | Phase::Ready | Phase::Restarting => NSColor::systemGreenColor(),
            Phase::Failed(_) => NSColor::systemOrangeColor(),
            _ => NSColor::controlAccentColor(),
        };
        self.status_icon.setContentTintColor(Some(&tint));
        self.checked
            .setStringValue(&NSString::from_str(&last_checked(state)));
        let busy = state.phase.is_busy();
        self.progress.setHidden(!busy);
        let determinate = state.phase == Phase::Downloading && state.total.is_some();
        self.progress.setIndeterminate(!determinate);
        if determinate {
            self.progress.setDoubleValue(
                (state.downloaded as f64 / state.total.unwrap() as f64 * 100.0).min(100.0),
            );
        }
        unsafe {
            if busy {
                self.progress.startAnimation(None);
            } else {
                self.progress.stopAnimation(None);
            }
        }
        self.transfer.setHidden(state.phase != Phase::Downloading);
        self.transfer
            .setStringValue(&NSString::from_str(&update_copy::download_detail(state)));
        self.copy.setHidden(state.error.is_none());
        self.copy
            .setTitle(&NSString::from_str("Copy Error Details"));
        let notes = state
            .notes
            .as_deref()
            .filter(|notes| !notes.trim().is_empty());
        self.notes_title.setHidden(notes.is_none());
        self.notes_scroll.setHidden(notes.is_none());
        let heading = state
            .version
            .as_deref()
            .map(|version| format!("What's New in Typa {version}"))
            .unwrap_or_default();
        let notes = notes.map(update_copy::readable_notes).unwrap_or_default();
        self.notes_title
            .setStringValue(&NSString::from_str(&heading));
        let mut previous = self.last_notes.borrow_mut();
        if *previous != notes {
            self.notes.setString(&NSString::from_str(&notes));
            *previous = notes;
        }
    }
}

fn notes_view(
    view: &NSView,
    mtm: MainThreadMarker,
) -> (Retained<NSScrollView>, Retained<NSTextView>) {
    let scroll =
        NSScrollView::initWithFrame(NSScrollView::alloc(mtm), frame(43.0, 74.0, 554.0, 73.0));
    scroll.setBorderType(NSBorderType::BezelBorder);
    scroll.setHasVerticalScroller(true);
    scroll.setAutohidesScrollers(true);
    scroll.setBackgroundColor(&NSColor::controlBackgroundColor());
    let notes = NSTextView::initWithFrame(NSTextView::alloc(mtm), frame(0.0, 0.0, 550.0, 73.0));
    notes.setEditable(false);
    notes.setSelectable(true);
    notes.setDrawsBackground(false);
    notes.setFont(Some(&NSFont::systemFontOfSize(11.0)));
    notes.setTextColor(Some(&NSColor::labelColor()));
    notes.setTextContainerInset(NSSize::new(8.0, 6.0));
    notes.setMinSize(NSSize::new(0.0, 73.0));
    notes.setMaxSize(NSSize::new(f64::MAX, f64::MAX));
    notes.setVerticallyResizable(true);
    notes.setHorizontallyResizable(false);
    notes.setAutoresizingMask(NSAutoresizingMaskOptions::ViewWidthSizable);
    // This NSTextView was created with AppKit's standard text container.
    if let Some(container) = unsafe { notes.textContainer() } {
        container.setContainerSize(NSSize::new(550.0, f64::MAX));
        container.setWidthTracksTextView(true);
    }
    scroll.setDocumentView(Some(&notes));
    view.addSubview(&scroll);
    (scroll, notes)
}

fn last_checked(state: &Snapshot) -> String {
    state
        .last_checked
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or_else(String::new, |duration| {
            let date = NSDate::dateWithTimeIntervalSince1970(duration.as_secs_f64());
            let date = NSDateFormatter::localizedStringFromDate_dateStyle_timeStyle(
                &date,
                NSDateFormatterStyle::ShortStyle,
                NSDateFormatterStyle::ShortStyle,
            );
            format!("Last checked {date}")
        })
}
