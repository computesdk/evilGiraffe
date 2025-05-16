package main

import (
	"fmt"
	"os/exec"
	"time"
)

func main() {
	fmt.Println("Starting Ollama...")

	// Start "ollama serve"
	ollamaCmd := exec.Command("ollama", "serve")
	err := ollamaCmd.Start()
	if err != nil {
		fmt.Println("Failed to start Ollama:", err)
		return
	}
	fmt.Println("Ollama started (PID):", ollamaCmd.Process.Pid)

	// Wait for Ollama to fully boot
	fmt.Println("Waiting 5 seconds for Ollama to initialize...")
	time.Sleep(5 * time.Second)

	// Start Node server
	fmt.Println("Starting Node server...")
	nodeCmd := exec.Command("node", "server.js")
	err = nodeCmd.Start()
	if err != nil {
		fmt.Println("Failed to start Node server:", err)
		return
	}
	fmt.Println("Node server started (PID):", nodeCmd.Process.Pid)
}
