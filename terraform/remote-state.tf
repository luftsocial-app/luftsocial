resource "random_string" "random" {
  length  = 12
  upper   = false
  number  = false
  lower   = true
  special = false
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "dev-state-bucket-${random_string.random.result}"
}

resource "aws_s3_bucket_ownership_controls" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}


resource "aws_s3_bucket_acl" "terraform_state" {
  depends_on = [aws_s3_bucket_ownership_controls.terraform_state]
  bucket     = aws_s3_bucket.terraform_state.id
  acl        = "private"
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
