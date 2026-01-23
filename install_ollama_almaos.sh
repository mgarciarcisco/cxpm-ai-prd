sudo dnf update -y
sudo dnf install -y curl
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl start ollama
ollama --version
