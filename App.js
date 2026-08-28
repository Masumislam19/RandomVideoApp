import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import HomeScreen from "./screens/HomeScreen";
import VideoCallScreen from "./screens/VideoCallScreen";

export default function App() {
  const [screen, setScreen] = useState("home"); // "home" | "call"

  return (
    <SafeAreaView style={styles.container}>
      {screen === "home" ? (
        <HomeScreen onStart={() => setScreen("call")} />
      ) : (
        <VideoCallScreen onExit={() => setScreen("home")} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
