#!/bin/bash
sudo apt update -y
sudo apt install -y docker.io docker-compose nginx git
sudo systemctl enable docker
sudo systemctl start docker

# Clone the NestJS App from GitHub
git clone https://github.com/your-repo.git /home/ubuntu/nestjs-app
cd /home/ubuntu/nestjs-app

# Start Docker Compose
sudo docker-compose up --build -d
