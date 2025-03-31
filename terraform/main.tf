provider "aws" {
  region = "eu-central-1"
}


terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.92.0"
    }
  }
}


/*
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.92.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state-bucket" # Use the name of your S3 bucket
    key            = "dev_terraform.tfstate"     # The path in the bucket where the state file will be stored
    encrypt        = true                        # Enable encryption for the state file
    dynamodb_table = "terraform-locks"           # Use the DynamoDB table for locking
    acl            = "private"                   # Set the appropriate ACL for the state file
  }
}

*/

/*
resource "aws_security_group" "nestjs_sg" {
  name        = var.security_group_name
  description = "Allow inbound traffic"

  ingress { from_port = 22   to_port = 22   protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }   # SSH
  ingress { from_port = 80   to_port = 80   protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }   # Nginx
  ingress { from_port = 443  to_port = 443  protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }   # SSL
  ingress { from_port = 5432 to_port = 5432 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }   # PostgreSQL
  ingress { from_port = 6379 to_port = 6379 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }   # Redis

  egress { from_port = 0 to_port = 0 protocol = "-1" cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_instance" "nestjs_server" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.my_key.key_name
  vpc_security_group_ids = [aws_security_group.nestjs_sg.id]

  user_data = file("scripts/setup.sh")

  tags = { Name = "nestjs-server" }
}


resource "aws_key_pair" "my_key" {
  key_name   = "nestjs-key-pair"
  public_key = file("~/.ssh/id_rsa.pub")  # Point this to your public key, or leave it out to generate a new one

  # Optionally, set a private key output
  # private_key = "path-to-your-private-key"   # This is optional and might not be needed in every case.
}
*/