import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import path from "path"; // Keep path for static serving even if direct path is used

// Import routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import courseRoutes from "./routes/courses.js";
import contentRoutes from "./routes/content.js";
import sessionRoutes from "./routes/sessions.js";
import paymentRoutes from "./routes/payments.js";
import enrollmentRoutes from "./routes/enrollments.js";
import progressRoutes from "./routes/progress.js";
import certificateRoutes from "./routes/certificates.js";
import adminRoutes from "./routes/admin.js";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// ✅ Allowed frontend origins
const allowedOrigins = [
  "http://localhost:8080",
  "https://learn-x-website-nirv.vercel.app",
  "https://learn-x-website-nirv-m2h0r6kj9.vercel.app",
  "https://learnx-backend-h6h0.onrender.com",
  "https://learn-x-website-nirv-cybexonics-it-consultants-pvt-s-projects.vercel.app" // ✅ Added your current frontend
];

// ✅ Manual CORS headers to guarantee preflight success
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ✅ Express CORS middleware (still needed for consistency)
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Ensure preflight handled globally
app.options("*", cors());

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

// Serve static files
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Database connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/courses", contentRoutes);
app.use("/api/courses", sessionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/certificate", certificateRoutes);
app.use("/api/admin", adminRoutes);

// Health check route for Render
app.get("/", (req, res) => {
  res.status(200).send("✅ LearnX backend is running successfully 🚀");
});

// API documentation route
app.get("/api-docs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin panel route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ---------------- SOCKET.IO ---------------- //
const sessions = new Map();

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("join-broadcast", (roomId, userId, userType) => {
    if (!roomId || !userId || !["instructor", "student"].includes(userType)) {
      socket.emit("error", "Invalid join parameters.");
      return;
    }

    socket.join(roomId);
    let session = sessions.get(roomId);

    if (!session) {
      session = {
        instructor: null,
        students: new Map(),
        messages: [],
        isLive: false,
        startTime: null,
        createdAt: new Date(),
      };
      sessions.set(roomId, session);
    }

    if (userType === "instructor") {
      if (
        session.instructor &&
        session.instructor.active &&
        session.instructor.socketId !== socket.id
      ) {
        socket.emit("error", "Another instructor is already active.");
        socket.leave(roomId);
        return;
      }

      session.instructor = { id: userId, socketId: socket.id, active: true };
      session.isLive = true;
      session.startTime = session.startTime || new Date();

      io.to(roomId).emit("broadcast-started", {
        instructorId: userId,
        startTime: session.startTime,
      });
    } else {
      session.students.set(userId, {
        socketId: socket.id,
        active: true,
        joinedAt: new Date(),
      });

      if (session.instructor?.active) {
        io.to(session.instructor.socketId).emit("student-joined", {
          roomId,
          userId,
          totalStudents: session.students.size,
        });
      }

      socket.emit("session-info", {
        isLive: session.isLive,
        startTime: session.startTime,
        messages: session.messages,
        totalStudents: session.students.size,
        instructorActive: session.instructor?.active || false,
      });
    }

    io.to(roomId).emit("participants-updated", {
      count: session.students.size + (session.instructor?.active ? 1 : 0),
    });
  });
});

// Endpoint to get live sessions
app.get("/api/live-sessions", (req, res) => {
  const activeSessions = [];

  sessions.forEach((session, roomId) => {
    if (session.isLive && session.instructor?.active) {
      activeSessions.push({
        id: roomId,
        startTime: session.startTime,
        participants: session.students.size + (session.instructor?.active ? 1 : 0),
        instructorId: session.instructor.id,
      });
    }
  });

  res.json({ success: true, sessions: activeSessions });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📘 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`🛠 Admin Panel: http://localhost:${PORT}/admin`);
});

console.log("🚀 LearnX backend initialized successfully");
