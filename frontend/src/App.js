import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import ChatPage from "@/pages/ChatPage";

export default function App() {
  return (
    <div className="App min-h-screen bg-[#0A0B0E] text-[#EAEAEA]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/c/:chatId" element={<ChatPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#111413",
            border: "1px solid #242E2A",
            color: "#EAEAEA",
          },
        }}
      />
    </div>
  );
}
