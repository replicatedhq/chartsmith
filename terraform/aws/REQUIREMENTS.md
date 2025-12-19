# Prerequisites for Chartsmith AWS Deployment

## AWS Account Requirements

### IAM Permissions

Your AWS credentials need these permissions (attach these policies to your user/role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "rds:*",
        "secretsmanager:*",
        "iam:*",
        "logs:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**Or use these AWS managed policies:**
- `EC2FullAccess`
- `RDSFullAccess` 
- `SecretsManagerFullAccess`
- `IAMFullAccess`
- `CloudWatchFullAccess`

### Resource Limits

Ensure your AWS account has sufficient service limits:

| Service | Required | Check Command |
|---------|----------|---------------|
| VPCs | 1 additional | `aws ec2 describe-account-attributes --attribute-names supported-platforms` |
| RDS Instances | 1 additional | `aws rds describe-account-attributes` |
| Security Groups | 5 additional | `aws ec2 describe-account-attributes --attribute-names max-security-groups-per-vpc` |

## Software Requirements

### Local Development Machine

1. **Terraform** (>= 1.0):
   ```bash
   # macOS
   brew install terraform
   
   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   
   # Verify
   terraform version
   ```

2. **AWS CLI** (>= 2.0):
   ```bash
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Verify
   aws --version
   ```

3. **Configure AWS CLI**:
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region, Output format
   
   # Test configuration
   aws sts get-caller-identity
   ```

## Network Requirements

### For New VPC Deployment
- No specific network requirements
- Terraform will create isolated VPC

### For Existing VPC Deployment
Your existing VPC must have:

1. **Internet Gateway** attached
2. **NAT Gateway or NAT Instance** for private subnet internet access
3. **Route Tables** properly configured:
   - Public subnets route 0.0.0.0/0 → Internet Gateway
   - Private subnets route 0.0.0.0/0 → NAT Gateway
4. **Multiple Availability Zones** (minimum 2)
5. **Sufficient IP addresses** in subnets

### Verify Existing VPC Setup
```bash
# Check VPC has Internet Gateway
aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=YOUR-VPC-ID"

# Check NAT Gateway exists
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=YOUR-VPC-ID"

# Check subnets span multiple AZs
aws ec2 describe-subnets --filters "Name=vpc-id,Values=YOUR-VPC-ID" --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock]'
```

## Security Requirements

### Network Access
- **Outbound Internet**: Required for downloading packages, API calls
- **Inbound Access**: Configure `allowed_cidr_blocks` to restrict access
- **Database Access**: Keep database in private subnets only

### Recommended Security Practices
1. **Use least privilege IAM policies**
2. **Enable CloudTrail** for audit logging
3. **Restrict CIDR blocks** to your office/VPN ranges
4. **Enable MFA** on AWS account
5. **Use separate AWS accounts** for different environments

## Pre-Deployment Checklist

- [ ] AWS CLI configured and tested
- [ ] Terraform installed and working
- [ ] AWS account has required permissions
- [ ] All API keys obtained and tested
- [ ] Network requirements verified (if using existing VPC)
- [ ] Backup strategy planned


## Next Steps

Once prerequisites are met:

1. Choose your [deployment scenario](examples/)
2. Copy and customize `terraform.tfvars.example`
3. Run `terraform init && terraform plan && terraform apply`
4. Follow the post-deployment steps in the example README
