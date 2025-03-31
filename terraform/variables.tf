variable "aws_region" { default = "eu-central-1" }
variable "instance_type" { default = "t3.micro" }
#variable "key_name" { description = "AWS SSH Key" }
variable "ami_id" { default = "ami-053b0d53c279acc90" } # Ubuntu 22.04
variable "security_group_name" { default = "nestjs_sg" }
