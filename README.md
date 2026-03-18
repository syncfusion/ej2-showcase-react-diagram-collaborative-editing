# ej2-showcase-react-diagram-collaborative-editing

A real-time collaborative diagram editor built with **React + TypeScript + Syncfusion Diagram** components. Multiple users can edit the same diagram simultaneously with WebSocket-powered real-time synchronization.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v18 or higher
- **npm**

### Installation

1. **Clone or navigate to the project directory**:
   ```powershell
   cd d:\13_02_2026_CollabSample
   ```

2. **Install frontend dependencies**:
   ```powershell
   npm install
   ```

### Running the Application

#### Terminal : Start the React App

```powershell
npm run start
```

The app will start at: **http://localhost:3000**

### Change WebSocket Server URL

Edit `src/collaboration/CollaborationService.ts`:

```typescript
constructor(serverUrl: string = 'ws://localhost:8080') {
  // Change to your server URL
  this.serverUrl = serverUrl;
}
```

### Change Server Port

Edit `server/server.js`:

```javascript
const PORT = 8080; // Change to your desired port
```

### Syncfusion License

For production use, you need a Syncfusion license. Get a **free 30-day trial** at:
https://www.syncfusion.com/account/manage-trials/downloads

Update `src/index.tsx`:

```typescript
registerLicense('YOUR_LICENSE_KEY_HERE');
```

Without a license, the app will show a trial banner but will work fully.

### Frontend

```powershell
npm run start      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run preview  # Preview production build
```


##  Learn More

### Syncfusion Documentation
- [React Diagram Component](https://ej2.syncfusion.com/react/documentation/diagram/getting-started)
- [Symbol Palette](https://ej2.syncfusion.com/react/documentation/diagram/symbol-palette)
- [React Toolbar](https://ej2.syncfusion.com/react/documentation/toolbar/getting-started)


##  Acknowledgments

- **Syncfusion** for the excellent React Diagram components
- **Vite** for blazing-fast development experience
- **React** team for the amazing framework

---

