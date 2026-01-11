# Fancy Steel Control

A modern, responsive web application for remote device control. This is a web-based version of the FANCY_CONTROL Android application, rebuilt with React and Node.js.

## Features

- **Authentication System** - Secure login with JWT tokens
- **User Management** - Admin can create, edit, and delete users
- **Permission System** - Granular permissions per feature with configurable limits
- **Single Page Control** - All controls on one page with modular tiles
- **Drag & Drop Tiles** - Organize tiles in your preferred order
- **Removable Tiles** - Hide tiles you don't need, restore them from the menu
- **5 Theme Options** - Default, Modern Remote, Steampunk, Futuristic, Neon Glow
- **Power Control** - Adjust power level with +/- buttons
- **Beep & Zap** - Separate buttons for short beep and zap signals
- **Mode Switches** - Pet Training, Pet Fast, Pet Freeze, Sleep, Random, Buzzer
- **Loop Timer** - Countdown timer with auto-restart loop
- **Tilt Control** - Check and set tilt values
- **Release Control** - Timed release with hold-to-activate
- **Lock Control** - Lock/unlock with force unlock option
- **Random Game** - Automated random actions with configurable parameters
- **Configurable Tooltips** - Hover tooltips with 3-second delay, editable via config file
- **Persistent Configuration** - All settings saved to `/config` volume
- **Docker Healthcheck** - Built-in health monitoring
- **Responsive Design** - Works on desktop, tablet, and mobile

## Tiles

| Tile | Description |
|------|-------------|
| **Power** | Power level (+/-), Beep button, Zap button |
| **Lock** | Lock/unlock toggle, right-click for force unlock |
| **Modes** | 6 mode switches in 2 columns + timer with loop toggle |
| **Release** | Release time (+/-), hold-to-release button |
| **Tilt** | Check current tilt, set new tilt value |
| **Random Game** | Automated random actions with configurable settings |

---

## Authentication & Permissions

### Authentication

The application requires authentication. An admin account is created automatically on first startup using environment variables.

| Environment Variable | Description | Required |
|---------------------|-------------|----------|
| `ADMIN_USERNAME` | Admin username | Yes |
| `ADMIN_PASSWORD` | Admin password (plain text) | Yes |
| `JWT_SECRET` | Secret for JWT tokens (auto-generated if not set) | No |

### User Management

Administrators can manage users from the **Admin.** panel (accessible via the hamburger menu):

- Create new users with custom permissions
- Edit user permissions and limits
- Reset user passwords
- Delete users
- Configure session duration

### Permissions

Each user can have specific permissions enabled/disabled:

| Permission | Description | Configurable Limit |
|------------|-------------|-------------------|
| `power_control` | Access to Power tile (power +/-, beep, zap) | `maxPower` (0-100%) |
| `lock_control` | Access to Lock tile | - |
| `modes_timer` | Access to Modes tile (modes, timer) | `allowedModes` (list) |
| `release_control` | Access to Release tile | - |
| `tilt_control` | Access to Tilt tile | - |
| `random_game` | Access to Random Game tile | `maxPower` (0-100%) |
| `device_settings` | Can modify device configuration | - |

**Example:** A user with `power_control` permission and `maxPower: 25` will:
- See only the Power tile
- Be unable to increase power above 25%
- See a "Max: 25%" indicator on the power display

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Styling | CSS3 with CSS Variables |
| Container | Docker with Healthcheck |
| State Management | React Context API |
| Storage | `/config` volume (persistent) |

---

## Docker Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

### Run with Docker Compose

```bash
# Clone the repository
git clone https://github.com/nahojnet/FancySteelWebAPP.git
cd FancySteelWebAPP

# Create .env file with admin credentials
cp .env.example .env
# Edit .env and set ADMIN_PASSWORD

# Build and run
docker-compose up --build -d

# App available at http://localhost:5000
```

Or with inline environment variables:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=your_password docker-compose up --build -d
```

### Run with Docker

```bash
# Build image
docker build -t fancy-steel-webapp .

# Run container (ADMIN_PASSWORD is required)
docker run -d \
  --name fancy-steel \
  -p 5000:5000 \
  -v fancy-steel-config:/config \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=your_secure_password \
  --restart unless-stopped \
  fancy-steel-webapp
```

### Health Check

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' fancy-steel-webapp

# Manual health check
curl http://localhost:5000/api/health
```

---

## Configuration Files

All configuration is stored in the `/config` directory:

| File | Description |
|------|-------------|
| `users.json` | User accounts and permissions |
| `auth-config.json` | Authentication settings (session duration) |
| `settings.json` | Device connection settings |
| `state.json` | Device state (power, switches) |
| `tiles.json` | Tile order and selected theme |
| `tooltips.json` | Tooltip text for all buttons |
| `randomgame.json` | Random game configuration |

### Tooltips Configuration

The `tooltips.json` file allows you to customize tooltip text for every button:

```json
{
  "power": {
    "minus": "Decrease power level by 5%",
    "plus": "Increase power level by 5%",
    "beep": "Short beep signal",
    "zap": "Send zap signal"
  },
  "lock": {
    "button": "Toggle lock state. Right-click to force unlock"
  },
  "modes": {
    "timer_minus": "Decrease timer by 10 seconds",
    "timer_plus": "Increase timer by 10 seconds",
    "timer_toggle": "Start/stop timer loop",
    "petTraining": "Pet Training mode",
    "petFast": "Fast Pet Training mode",
    "petFreeze": "Freeze Pet Training mode",
    "sleep": "Sleep mode",
    "random": "Random mode",
    "buzzer": "Toggle buzzer sound"
  },
  "release": {
    "minus": "Decrease release time",
    "plus": "Increase release time",
    "button": "Hold to release"
  },
  "tilt": {
    "check": "Check current tilt value",
    "set": "Set new tilt value"
  }
}
```

---

## Device Endpoints

The backend proxies requests to the device at `192.168.4.1` (configurable):

| Action | Endpoint |
|--------|----------|
| Power Up | `/PW/+` |
| Power Down | `/PW/-` |
| Beep | `/B1/1` |
| Zap | `/Z1/1` |
| Lock | `/loc1/1` |
| Unlock | `/loc1/0` |
| Pet Training | `/mode/S2` |
| Pet Fast | `/mode/S2F` |
| Pet Freeze | `/mode/S2Z` |
| Sleep | `/mode/S4` |
| Random | `/mode/RN` |
| Timer Mode | `/mode/TM` |
| Mode Off | `/mode/0` |
| Buzzer On | `/S1/1` |
| Buzzer Off | `/S1/0` |
| Check Tilt | `/DIS/BOW` |
| Set Tilt | `/TX?TILTVAL=X` |
| Release | `/REL/0` |

---

## API Endpoints

### Authentication (public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login with username/password |
| `GET` | `/api/auth/verify` | Verify JWT token validity |
| `GET` | `/api/auth/me` | Get current user info |

### Administration (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Create new user |
| `PUT` | `/api/admin/users/:id` | Update user permissions |
| `DELETE` | `/api/admin/users/:id` | Delete user |
| `POST` | `/api/admin/users/:id/reset-password` | Reset user password |
| `GET` | `/api/admin/auth-config` | Get auth configuration |
| `PUT` | `/api/admin/auth-config` | Update auth configuration |

### Device & Configuration (authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check (public, used by Docker) |
| `GET` | `/api/state` | Get device state |
| `POST` | `/api/state` | Update device state |
| `GET` | `/api/config` | Get app configuration |
| `POST` | `/api/config` | Update app configuration |
| `GET` | `/api/config/tiles` | Get tiles order & theme |
| `POST` | `/api/config/tiles` | Save tiles order & theme |
| `GET` | `/api/config/tooltips` | Get tooltip configuration |
| `POST` | `/api/config/tooltips` | Save tooltip configuration |
| `GET` | `/api/device/check` | Check device connection |
| `ALL` | `/api/device/proxy/*` | Proxy requests to device |

All endpoints except `/api/health` and `/api/auth/login` require a valid JWT token in the `Authorization: Bearer <token>` header.

---

## Local Development

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone repository
git clone https://github.com/nahojnet/FancySteelWebAPP.git
cd FancySteelWebAPP

# Install dependencies
cd frontend && npm install
cd ../backend && npm install
```

### Running

```bash
# Terminal 1: Backend (with required env vars)
cd backend
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 CONFIG_PATH=../config npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Default admin login: `admin` / `admin123` (as set above)

---

## Project Structure

```
FancySteelWebAPP/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx        # Header with menu
│   │   │   ├── ProtectedRoute.jsx # Auth route wrapper
│   │   │   ├── Toggle.jsx        # Switch component
│   │   │   ├── Button.jsx        # Button component
│   │   │   ├── Card.jsx          # Tile container
│   │   │   ├── Tooltip.jsx       # Tooltip with delay
│   │   │   └── Notifications.jsx
│   │   ├── pages/
│   │   │   ├── LocalMode.jsx     # Main control page
│   │   │   ├── Login.jsx         # Login page
│   │   │   └── Admin.jsx         # Admin panel
│   │   ├── context/
│   │   │   ├── AppContext.jsx    # App state management
│   │   │   └── AuthContext.jsx   # Auth state management
│   │   ├── styles/
│   │   │   └── index.css         # All styles + themes
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── server.js             # Express API + device proxy
│   │   └── auth.js               # Authentication module
│   └── package.json
├── config/                        # Persistent configuration (volume)
│   ├── users.json                # User accounts
│   ├── auth-config.json          # Auth settings
│   ├── settings.json
│   ├── state.json
│   ├── tiles.json
│   ├── tooltips.json
│   └── randomgame.json
├── .env.example                   # Environment variables template
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Themes

5 built-in themes accessible from the hamburger menu:

| Theme | Colors |
|-------|--------|
| Default | Purple/Indigo |
| Modern Remote | Cyan/Blue |
| Steampunk | Bronze/Copper |
| Futuristic | Green glow |
| Neon Glow | Magenta/Pink |

Theme selection is saved to `tiles.json` and persists across sessions.

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers

---

## License

MIT License

---

## Credits

Converted from FANCY_CONTROL_V7B Android application to modern web app.
