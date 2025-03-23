resource "aws_s3_bucket" "terraform_state" {
  bucket = "dev-state-bucket" # Make sure the bucket name is globally unique
}


resource "aws_s3_bucket_acl" "terraform_state" {

  bucket = aws_s3_bucket.terraform_state.id
  acl    = "private"
}


resource "aws_dynamodb_table" "terraform_locks" {
  name           = "dev-terraform-locks"
  hash_key       = "LockID"
  read_capacity  = 5
  write_capacity = 5

  attribute {
    name = "LockID"
    type = "S"
  }

  billing_mode = "PROVISIONED"
}
