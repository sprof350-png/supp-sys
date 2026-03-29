import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";

const PORT = 3000;
const DB_FILE = "db.json";

// Initial database structure
const initialDb = {
  users: [
    { id: "1", username: "admin", password: "123", role: "admin" },
    { id: "2", username: "staff", password: "123", role: "staff" }
  ],
  services: [],
  engineers: [],
  usage: []
};

// Load or initialize database
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
}

const getDb = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    if (!data.trim()) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading db.json:", e);
    return initialDb;
  }
};
const saveDb = (db: any) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  // API Routes
  app.get("/api/db", (req, res) => {
    res.json(getDb());
  });

  app.get("/api/db-download", (req, res) => {
    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename=syndicate_db_backup_${timestamp}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  app.post("/api/update", (req, res) => {
    const { type, data } = req.body;
    const db = getDb();
    db[type] = data;
    saveDb(db);
    io.emit("db-update", db);
    res.json({ success: true });
  });

  // Download source code endpoint
  app.get("/api/download-source", (req, res) => {
    try {
      const zip = new AdmZip();
      const rootDir = process.cwd();
      
      // Add files to zip, excluding node_modules and dist
      const files = fs.readdirSync(rootDir);
      files.forEach(file => {
        const filePath = path.join(rootDir, file);
        const stats = fs.statSync(filePath);
        
        if (file === 'node_modules' || file === 'dist' || file === '.git' || file === '.next') return;
        
        if (stats.isDirectory()) {
          zip.addLocalFolder(filePath, file);
        } else {
          zip.addLocalFile(filePath);
        }
      });

      const buffer = zip.toBuffer();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename=syndicate_app_source_${timestamp}.zip`);
      res.send(buffer);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error creating zip');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  io.on("connection", (socket) => {
    console.log("Client connected");
    socket.emit("db-update", getDb());
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
