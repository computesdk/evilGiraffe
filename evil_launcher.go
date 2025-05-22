package main

import (
	"log"
	"os/exec"
)

func main() {
	// First command
	cmd1 := exec.Command("ollama", "serve")
	cmd1.Stdout = log.Writer()
	cmd1.Stderr = log.Writer()
	cmd1.Start()

	// Second command
	cmd2 := exec.Command("node", "server.js")
	cmd2.Stdout = log.Writer()
	cmd2.Stderr = log.Writer()
	cmd2.Run()
}
