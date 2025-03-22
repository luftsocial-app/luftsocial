resource "aws_s3_bucket" "app_code" {
  bucket = "my-app-code-bucket"  # Use a unique name for your bucket
  acl    = "private"              # Set the appropriate ACL for security
}


resource "aws_s3_bucket_object" "app_code_object" {
  bucket = aws_s3_bucket.app_code.bucket  # Reference the S3 bucket created above
  key    = "code/app.zip"                 # The key (path) where the code will be stored in the bucket
  source = "path/to/your/app.zip"         # Path to your application code (e.g., a zip file)
  acl    = "private"                      # Set the ACL to private for security
}
