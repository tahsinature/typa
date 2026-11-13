use super::views;
use crate::preferences_settings::{self, Preferences};
use objc2::{
    define_class, msg_send, rc::Retained, runtime::ProtocolObject, sel, DefinedClass,
    MainThreadMarker, MainThreadOnly,
};
use objc2_app_kit::{
    NSAppearance, NSAppearanceCustomization, NSButton, NSImage, NSPopUpButton, NSToolbar,
    NSToolbarDelegate, NSToolbarDisplayMode, NSToolbarFlexibleSpaceItemIdentifier, NSToolbarItem,
    NSWindow, NSWindowCollectionBehavior, NSWindowTabbingMode, NSWindowToolbarStyle,
};
use objc2_foundation::{NSArray, NSCopying, NSObject, NSObjectProtocol, NSSize, NSString};
use std::cell::{Cell, RefCell};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

thread_local! {
    static CONTROLLER: RefCell<Option<Retained<PreferencesController>>> = const { RefCell::new(None) };
}

pub struct ControllerState {
    app: AppHandle,
    window: Retained<NSWindow>,
    pane: Cell<usize>,
}

const PANES: [(&str, &str); 3] = [
    ("General", "gearshape"),
    ("Appearance", "paintpalette"),
    ("Shortcuts", "keyboard"),
];

fn identifiers() -> Retained<NSArray<NSString>> {
    NSArray::from_retained_slice(&PANES.map(|(name, _)| NSString::from_str(name)))
}

fn default_identifiers() -> Retained<NSArray<NSString>> {
    let mut items = vec![unsafe { NSToolbarFlexibleSpaceItemIdentifier }.copy()];
    items.extend(PANES.map(|(name, _)| NSString::from_str(name)));
    items.push(unsafe { NSToolbarFlexibleSpaceItemIdentifier }.copy());
    NSArray::from_retained_slice(&items)
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = ControllerState]
    pub struct PreferencesController;

    unsafe impl NSObjectProtocol for PreferencesController {}

    unsafe impl NSToolbarDelegate for PreferencesController {
        #[unsafe(method_id(toolbarDefaultItemIdentifiers:))]
        fn default_items(&self, _: &NSToolbar) -> Retained<NSArray<NSString>> {
            default_identifiers()
        }

        #[unsafe(method_id(toolbarAllowedItemIdentifiers:))]
        fn allowed_items(&self, _: &NSToolbar) -> Retained<NSArray<NSString>> {
            default_identifiers()
        }

        #[unsafe(method_id(toolbarSelectableItemIdentifiers:))]
        fn selectable_items(&self, _: &NSToolbar) -> Retained<NSArray<NSString>> {
            identifiers()
        }

        #[unsafe(method_id(toolbar:itemForItemIdentifier:willBeInsertedIntoToolbar:))]
        fn toolbar_item(&self, _: &NSToolbar, identifier: &NSString, _: bool) -> Option<Retained<NSToolbarItem>> {
            self.make_toolbar_item(identifier)
        }
    }

    impl PreferencesController {
        #[unsafe(method(selectPane:))]
        fn select_pane(&self, sender: &NSToolbarItem) {
            self.ivars().pane.set(sender.tag() as usize);
            if let Some(toolbar) = self.ivars().window.toolbar() {
                toolbar.setSelectedItemIdentifier(Some(&sender.itemIdentifier()));
            }
            self.render();
        }

        #[unsafe(method(changePopup:))]
        fn change_popup(&self, sender: &NSPopUpButton) {
            let mut settings = self.settings();
            let index = sender.indexOfSelectedItem() as usize;
            match sender.tag() {
                0 => settings.layout = ["horizontal", "vertical"][index].into(),
                1 => settings.theme = ["system", "light", "dark"][index].into(),
                2 => settings.font_size = (index + 8) as u8,
                3 => settings.palette_style = ["raycast", "linear", "arc"][index].into(),
                _ => return,
            }
            self.save(settings);
        }

        #[unsafe(method(changeSidebar:))]
        fn change_sidebar(&self, sender: &NSButton) {
            let mut settings = self.settings();
            settings.sidebar_open = sender.state() == 1;
            self.save(settings);
        }
    }
);

impl PreferencesController {
    fn make_toolbar_item(&self, identifier: &NSString) -> Option<Retained<NSToolbarItem>> {
        let index = PANES
            .iter()
            .position(|(name, _)| identifier.to_string() == *name)?;
        let item =
            NSToolbarItem::initWithItemIdentifier(NSToolbarItem::alloc(self.mtm()), identifier);
        item.setLabel(identifier);
        item.setTag(index as isize);
        item.setImage(
            NSImage::imageWithSystemSymbolName_accessibilityDescription(
                &NSString::from_str(PANES[index].1),
                Some(identifier),
            )
            .as_deref(),
        );
        // The retained controller outlives these weak targets. Selectors match their sender types.
        unsafe {
            item.setTarget(Some(self));
            item.setAction(Some(sel!(selectPane:)));
        }
        Some(item)
    }

    fn settings(&self) -> Preferences {
        preferences_settings::read(&self.ivars().app)
            .ok()
            .flatten()
            .unwrap_or_default()
    }

    fn save(&self, settings: Preferences) {
        if let Err(error) = preferences_settings::update(&self.ivars().app, &settings) {
            self.ivars()
                .app
                .dialog()
                .message(format!("Could not save preferences: {error}"))
                .title("Typa Preferences")
                .kind(MessageDialogKind::Error)
                .show(|_| {});
            self.render();
        } else {
            self.apply_appearance(&settings);
        }
    }

    fn apply_appearance(&self, settings: &Preferences) {
        let appearance = match settings.theme.as_str() {
            "dark" => {
                NSAppearance::appearanceNamed(&NSString::from_str("NSAppearanceNameDarkAqua"))
            }
            "light" => NSAppearance::appearanceNamed(&NSString::from_str("NSAppearanceNameAqua")),
            _ => None,
        };
        self.ivars().window.setAppearance(appearance.as_deref());
    }

    fn render(&self) {
        let settings = self.settings();
        self.apply_appearance(&settings);
        let view = views::pane(self, self.ivars().pane.get(), &settings);
        self.ivars().window.setContentView(Some(&view));
    }
}

pub fn open(app: AppHandle) {
    CONTROLLER.with(|slot| {
        let mut slot = slot.borrow_mut();
        if slot.is_none() {
            let mtm = MainThreadMarker::new().expect("preferences run on the main thread");
            let window = super::window::create(mtm);
            // Rust retains the window so closing it must not release AppKit's ownership again.
            unsafe { window.setReleasedWhenClosed(false) };
            window.setTitle(&NSString::from_str("Preferences"));
            window.setTabbingMode(NSWindowTabbingMode::Disallowed);
            window.setCollectionBehavior(NSWindowCollectionBehavior::FullScreenNone);
            window.setToolbarStyle(NSWindowToolbarStyle::Preference);
            let controller = PreferencesController::alloc(mtm).set_ivars(ControllerState {
                app,
                window: window.clone(),
                pane: Cell::new(0),
            });
            let controller: Retained<PreferencesController> =
                unsafe { msg_send![super(controller), init] };
            let toolbar = NSToolbar::initWithIdentifier(
                NSToolbar::alloc(mtm),
                &NSString::from_str("TypaPreferences"),
            );
            toolbar.setDelegate(Some(ProtocolObject::from_ref(&*controller)));
            toolbar.setAllowsUserCustomization(false);
            toolbar.setDisplayMode(NSToolbarDisplayMode::IconAndLabel);
            window.setToolbar(Some(&toolbar));
            toolbar.setSelectedItemIdentifier(Some(&NSString::from_str("General")));
            controller.render();
            window.setContentSize(NSSize::new(640.0, 400.0));
            window.center();
            *slot = Some(controller);
        }
        if let Some(controller) = slot.as_ref() {
            controller.render();
            controller.ivars().window.makeKeyAndOrderFront(None);
        }
    });
}

pub fn refresh() {
    CONTROLLER.with(|slot| {
        if let Some(controller) = slot.borrow().as_ref() {
            controller.render();
        }
    });
}
