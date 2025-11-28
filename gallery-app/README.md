# AWS Gallery Application

A full-stack image gallery application demonstrating AWS services integration including EC2, RDS, and S3.

## Features

- User authentication (register/login)
- Image upload to S3
- Image gallery with metadata
- Image deletion
- Session management

## Prerequisites

- Node.js (v14 or higher)
- AWS CLI configured or EC2 instance with IAM role
- AWS Account with S3 bucket
- RDS MySQL database
- PM2 (for production deployment)

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure AWS credentials (local development):**
   ```bash
   aws configure
   ```
   Or set environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and S3 bucket name.

4. **Run the application:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   Open http://localhost:3000 in your browser.

## Production Deployment on EC2

### 1. Server Setup

```bash
# Update system
sudo yum update -y

# Install Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install PM2 globally
npm install -g pm2
```

### 2. Application Deployment

```bash
# Clone or upload your application
# Navigate to application directory
cd /path/to/gallery-app

# Install dependencies
npm install --production

# Configure environment variables
cp .env.example .env
nano .env  # Edit with your production values

# Start with PM2
npm run prod

# Save PM2 configuration
pm2 save
pm2 startup
```

### 3. AWS Configuration

**RDS Database:**
- Create MySQL RDS instance
- Configure security group to allow EC2 access
- Create database: `gallery_db`
- Update `.env` with RDS endpoint

**S3 Bucket:**
- Create S3 bucket for image storage
- Update `.env` with bucket name

**EC2 IAM Role:**
- Create IAM role with S3 and RDS permissions
- Attach role to EC2 instance
- No need for access keys in production

**EC2 Security Group:**
- Allow inbound traffic on port 3000 (or 80/443 with reverse proxy)
- Allow outbound traffic to RDS and S3

### 4. PM2 Management Commands

```bash
# View running processes
pm2 list

# View logs
pm2 logs aws-gallery-app

# Restart application
pm2 restart aws-gallery-app

# Stop application
pm2 stop aws-gallery-app

# Monitor
pm2 monit
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_HOST` | RDS endpoint |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name |
| `AWS_REGION` | AWS region |
| `S3_BUCKET_NAME` | S3 bucket name |
| `PORT` | Application port |
| `SESSION_SECRET` | Session encryption key |

## API Endpoints

- `POST /register` - User registration
- `POST /login` - User login
- `POST /logout` - User logout
- `POST /upload` - Image upload
- `GET /images` - Get user images
- `DELETE /images/:id` - Delete image

## Troubleshooting

**Database Connection Issues:**
- Verify RDS security group allows EC2 access
- Check database credentials in `.env`

**S3 Upload Issues:**
- Verify AWS credentials (CLI or IAM role)
- Check S3 bucket permissions
- Ensure EC2 instance has proper IAM role

**Application Not Starting:**
- Check PM2 logs: `pm2 logs`
- Verify all environment variables are set