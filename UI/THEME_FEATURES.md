# Theme Features

## Light/Dark Theme Switch

The Soroban Security Portal now supports both light and dark themes with a toggle switch.

### Features

- **Theme Toggle Button**: Located in the top AppBar next to the user menu
- **Persistent Theme**: Theme preference is saved in localStorage and persists across browser sessions
- **Automatic Theme Application**: All components automatically adapt to the selected theme
- **Smooth Transitions**: Theme changes are applied instantly without page refresh

### Theme Colors

#### Light Theme
- **Background**: Light gray (#f7f8fa)
- **Paper**: White (#F2F2F2)
- **Text**: Dark (#000000)
- **Primary**: Blue (#1976d2)
- **Dividers**: Light gray (#e0e0e0)

#### Dark Theme
- **Background**: Dark gray (#121212)
- **Paper**: Darker gray (#1e1e1e)
- **Text**: White (#F2F2F2)
- **Primary**: Light blue (#90caf9)
- **Dividers**: Dark gray (#333333)

### Implementation Details

#### Theme Context
- Located in `src/contexts/ThemeContext.tsx`
- Provides theme state management
- Handles localStorage persistence
- Sets CSS custom properties for theme-aware styling

#### Components Updated
- `MainWindow`: Regular user interface with theme toggle
- `AdminMainWindow`: Admin interface with theme toggle
- `Home`: Updated to use theme-aware styling
- All Material-UI components automatically adapt to theme

#### CSS Custom Properties
The theme system uses CSS custom properties for styling that can't be handled by Material-UI:
- `--highlight-bg`: Background color for highlighted sections
- `--highlight-border`: Border color for highlighted sections

### Usage

1. Click the theme toggle button (moon/sun icon) in the top AppBar
2. The theme will switch immediately
3. Your preference will be saved and restored on future visits

### Technical Notes

- Uses Material-UI's `createTheme` for consistent theming
- Implements React Context for state management
- Leverages Material-UI's built-in theme support
- Maintains backward compatibility with existing components 