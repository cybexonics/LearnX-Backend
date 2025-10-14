import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

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

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Proper CORS configuration for frontend connection
const allowedOrigins = [
  "https://learn-x-website.vercel.app", // live frontend
  "http://localhost:5173"               // local dev (optional)
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Handle preflight requests (important!)
app.options("*", cors());

// ✅ Common middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(morgan("dev"));

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Static + Routes
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// ✅ MongoDB connect
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ API Routes
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

// ✅ Health Check
app.get("/", (req, res) => {
  res.status(200).send("LearnX backend working fine 🚀");
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
