# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Delete**: double display of the number of tasks in Kanban
- **Kanban**:  the name of the Kanban section has always been "Kanban"

### Changed
- **typescript**: It goes from "6.0.3" to "7.0.2"
- **@types/node**: It goes from "16.11.6" to "26.1.2"
- **tslib**: It goes from "2.4.0" to "2.8.1"

## [0.2.8] - 2026-08-01

### Fixed
- **Errors**: Fixed errors in the obsidian review.

## [0.2.7] - 2026-08-01

### Fixed
- **Errors**: Fixed errors in the obsidian review.

## [0.2.6] - 2026-08-01

### Added
- **Required**: add getSettingDefinitions() necessary from versions 1.13 onwards

### Fixed
- **Errors**: Fixed errors in the obsidian review.

## [0.2.5] - 2026-07-31

### Changed
- **Min App Version**: It goes from "1.7.2" to "1.13.0"

### Fixed
- **Lot of little correction**: Use new Setting(containerEl), Sets styles directly instead of using CSS classes, and others.

## [0.2.4] - 2026-07-29

### Added
- **New module**: Agent in Beta version, have a natural discussion of the tasks to be done.
To have advice, recommendations, ask to delete creates or edits tasks.

### Changed
- **Dependency**: Bump esbuild from 0.28.0 to 0.28.1 


## [0.2.3] - 2026-06-04

### Added
- **Localization**: Added full German language support.
- **Data Migration**: Added automatic migration from `.Harmony` to `Harmony` folder to ensure compatibility with unofficial sync services.
- **Task Management**: Introduced a new seamless task view-switching system for a smoother workflow.


## [0.2.2] - 2026-05-29

### Added
-**Core feature**: Can rename the file and the link follows the new file name.
-**Kanban**: Now you can move a task from one board to another.
-**Calendar**: New features
  - Button to hide the vertical bar on the left to select a day.
  - Use of the left right arrow keys to move the calendar into weeks and months.
-**Dashboard**:
  - Automatic focus on the keyboard to go directly into the search bar.
  - The tasks on the dashboard make sense and direct us to the kanban/todo/calendar task view. 

### Fixed
-**Kanban**: The linkage in the kanban is saved; when you restart it, it no longer disappears.

## [0.2.1] - 2026-05-26

### Fixed
-**Interface**: Fixed a critical bug where the calendar isn’t removed from the ribbon.
-**CSS Style**: removal of misuse of! important.

### Changed
- **Roadmap**: Updated of the project Roadmap.

## [0.2.0] - 2026-05-25

### Added
- **Localization**: Added Spanish language support.
- **Calendar View**: Introduced a brand new calendar module featuring:
  - View tasks with due dates in a clean calendar interface.
  - Click on a specific date to view all tasks assigned to that day.
  - Drag & drop tasks between dates for quick rescheduling.
  - Visual indicators for task priorities.

### Changed
- **Task Module**: Updated and improved the core task module infrastructure to support the new calendar integration.

## [0.1.10] - 2026-05-23

### Fixed

-**Interface**: Fixed the critical bug that prevented icons from being correctly removed from the sidebar (Ribbon bar) when switching modules.
-**CSS Style**: Optimization of CSS selectors to fix compatibility warnings with Obsidian 1.6.5 and removal of misuse of! important.

### Changed
-**Dependencies**: Updating the TypeScript package to the latest stable version.
-**Architecture**: Complete replacement of the builtin-modules package (deprecated) to ensure the plugin’s durability.


## [0.1.9] - 2026-05-22

### Fixed

- Migrated hardcoded dynamic styles to setCssProps and CSS variables for better theming compatibility.
- Resolved TypeScript warnings (replaced any with unknown, fixed assertion errors).
- Fixed unsafe member access in view registry logic.
- Resolved unhandled promise rejections and fixed incorrect async return types in event listeners.
- Refined module lifecycle management to prevent memory leaks and event-related errors.

### Changed

- Improved adherence to Obsidian's plugin linting standards.
- Optimized the separation between logic (TypeScript) and styling (CSS).

## [0.1.8] - 2026-05-15

## Fixed
- **CSS Styling**: Migrated from direct property injection to CSS classes.
- **Type Safety**: Fixed TypeScript warnings, any types, and unnecessary assertions.
- **Async Operations**: Resolved unhandled promises and lifecycle return types.

## Changed
- **Dependencies**: Replaced deprecated builtin-modules package.

## [0.1.7] - 2026-05-15

### Fixed
- Plugin Lifecycle
- API Compatibility
- View Registration

### Changed
- Internal Architecture

## [0.1.6] - 2026-05-14

### Changed
- Renamed project from "Obsidian Ultimate" to "Harmony" to comply with Obsidian plugin policies
- Updated plugin ID and description

## [0.1.5] - 2026-05-13

### Added
- Module loading and unloading system
- French and English translations
- Dashboard: wallpaper, searchbar, urgent task widget
- Kanban: multiple boards, columns, task archiving and sorting
- Todo List: add, check, sort, and delete tasks

---
[Unreleased]: https://github.com/Yodavatar/Harmony/compare/0.2.6...HEAD
[0.2.4]: https://github.com/Yodavatar/Harmony/compare/0.2.5...0.2.6
[0.2.4]: https://github.com/Yodavatar/Harmony/compare/0.2.4...0.2.5
[0.2.4]: https://github.com/Yodavatar/Harmony/compare/0.2.3...0.2.4
[0.2.3]: https://github.com/Yodavatar/Harmony/compare/0.2.2...0.2.3
[0.2.2]: https://github.com/Yodavatar/Harmony/compare/0.2.1...0.2.2
[0.2.1]: https://github.com/Yodavatar/Harmony/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/Yodavatar/Harmony/compare/0.1.10...0.2.0
[0.1.10]: https://github.com/Yodavatar/Harmony/compare/0.1.9...0.1.10
[0.1.9]: https://github.com/Yodavatar/Harmony/compare/0.1.8...0.1.9
[0.1.8]: https://github.com/Yodavatar/Harmony/compare/0.1.7...0.1.8
[0.1.7]: https://github.com/Yodavatar/Harmony/compare/0.1.6...0.1.7
[0.1.6]: https://github.com/Yodavatar/Harmony/compare/0.1.5...0.1.6
[0.1.5]: https://github.com/Yodavatar/Harmony/releases/tag/0.1.5