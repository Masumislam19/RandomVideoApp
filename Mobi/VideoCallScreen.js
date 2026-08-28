import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { io } from "socket.io-client";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from "react-native-webrtc";

// TODO: replace with your deployed signaling server URL (Render/Railway etc.)
const SIGNALING_SERVER_URL = "https://your-signaling-server.onrender.com";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Add a free TURN server here if peers behind strict NAT can't connect.
    // Example (Open Relay Project - check current credentials before using):
    // {
    //   urls: "turn:openrelay.metered.ca:80",
    //   username: "openrelayproject",
    //   credential: "openrelayproject",
    // },
  ],
};

export default function VideoCallScreen({ onExit }) {
  const [status, setStatus] = useState("connecting"); // connecting | waiting | matched | disconnected
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const partnerIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function setup() {
      // 1. Get local camera/mic stream
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      });
      if (!isMounted) return;
      setLocalStream(stream);

      // 2. Connect to signaling server
      const socket = io(SIGNALING_SERVER_URL, { transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        setStatus("waiting");
        socket.emit("find-match");
      });

      socket.on("waiting", () => setStatus("waiting"));

      socket.on("matched", async ({ partnerId, initiator }) => {
        partnerIdRef.current = partnerId;
        setStatus("matched");
        await createPeerConnection(stream, socket);

        if (initiator) {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          socket.emit("signal", { to: partnerId, data: { type: "offer", sdp: offer } });
        }
      });

      socket.on("signal", async ({ from, data }) => {
        if (!pcRef.current) return;

        if (data.type === "offer") {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socket.emit("signal", { to: from, data: { type: "answer", sdp: answer } });
        } else if (data.type === "answer") {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === "ice-candidate") {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.log("ICE candidate error", e);
          }
        }
      });

      socket.on("partner-left", () => {
        cleanupPeerConnection();
        setStatus("waiting");
        socket.emit("find-match");
      });
    }

    setup();

    return () => {
      isMounted = false;
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPeerConnection(stream, socket) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate && partnerIdRef.current) {
        socket.emit("signal", {
          to: partnerIdRef.current,
          data: { type: "ice-candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };
  }

  function cleanupPeerConnection() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    partnerIdRef.current = null;
  }

  function cleanupAll() {
    cleanupPeerConnection();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (socketRef.current) {
      socketRef.current.emit("stop");
      socketRef.current.disconnect();
    }
  }

  function handleSkip() {
    cleanupPeerConnection();
    setStatus("waiting");
    socketRef.current?.emit("skip");
  }

  function handleStop() {
    cleanupAll();
    onExit();
  }

  return (
    <View style={styles.container}>
      {/* Remote video (big, background) */}
      {remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.remoteVideo}>
          <Text style={styles.statusText}>
            {status === "connecting" && "Connecting..."}
            {status === "waiting" && "Looking for someone..."}
            {status === "matched" && "Connecting to stranger..."}
          </Text>
        </View>
      )}

      {/* Local video (small, corner) */}
      {localStream && (
        <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror />
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.button, styles.skipButton]} onPress={handleSkip}>
          <Text style={styles.buttonText}>Next ▶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={handleStop}>
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  remoteVideo: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  localVideo: {
    position: "absolute",
    top: 40,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 10,
    backgroundColor: "#222",
  },
  statusText: { color: "#888", fontSize: 16 },
  controls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginHorizontal: 8,
  },
  skipButton: { backgroundColor: "#3b82f6" },
  stopButton: { backgroundColor: "#ef4444" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
