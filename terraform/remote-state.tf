resource "aws_s3_bucket" "terraform_state" {
  bucket = "my-terraform-state-bucket"  # Make sure the bucket name is globally unique
  acl    = "private"
}


resource "aws_dynamodb_table" "terraform_locks" {
  name           = "terraform-locks"
  hash_key       = "LockID"
  read_capacity  = 5
  write_capacity = 5

  attribute {
    name = "LockID"
    type = "S"
  }

  billing_mode = "PROVISIONED"
}
