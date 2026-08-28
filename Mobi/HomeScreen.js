import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function HomeScreen({ onStart }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Random Video</Text>
      <Text style={styles.subtitle}>Talk to a random stranger</Text>

      <TouchableOpacity style={styles.startButton} onPress={onStart}>
        <Text style={styles.startButtonText}>Start</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Be respectful. You can leave the chat anytime.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 48,
  },
  startButton: {
    backgroundColor: "#22c55e",
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 30,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    color: "#555",
    fontSize: 12,
    textAlign: "center",
  },
});
