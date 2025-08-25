# 🚀 Render Deployment Guide

วิธี deploy Kahoo ไปยัง Render step-by-step

## 🔧 Pre-deployment Setup

### 1. Push Code ไปยัง GitHub
```bash
git add .
git commit -m "🚀 Ready for Render deployment"
git push origin master
```

## 🌟 Render Setup

### 1. สร้าง Account ที่ render.com
- เข้า https://render.com
- Sign up with GitHub account

### 2. สร้าง PostgreSQL Database
1. ไปที่ Dashboard → **New** → **PostgreSQL**
2. ตั้งค่า:
   - **Name**: `kahoo-postgres`
   - **Database**: `kahoo`
   - **User**: `kahoo_user`
   - **Region**: Oregon (US West)
   - **PostgreSQL Version**: 14+
3. คลิก **Create Database**
4. **บันทึก Database URL** (จะต้องใช้ในขั้นตอนถัดไป)

### 3. สร้าง Web Service
1. Dashboard → **New** → **Web Service**
2. Connect GitHub repository: `kahoo`
3. ตั้งค่า:
   - **Name**: `kahoo-game`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build:prod`
   - **Start Command**: `npm start`

### 4. Environment Variables
เพิ่มตัวแปรเหล่านี้ใน **Environment** tab:

```env
NODE_ENV=production
JWT_SECRET=<random-generated-secret>
DATABASE_URL=<your-postgres-database-url>
PORT=10000
ALLOWED_ORIGINS=https://<your-app-name>.onrender.com
```

**สำคัญ**: 
- **JWT_SECRET**: ใช้ Render's auto-generate หรือสร้างเอง
- **DATABASE_URL**: Copy จาก PostgreSQL ที่สร้างไว้
- **ALLOWED_ORIGINS**: แทนที่ `<your-app-name>` ด้วยชื่อ app จริง

### 5. Advanced Settings (Optional)
- **Health Check Path**: `/health`
- **Auto-Deploy**: `Yes`

## 🚀 Deploy Process

1. คลิก **Create Web Service**
2. รอการ deploy (ประมาณ 3-5 นาที)
3. Render จะ:
   - Pull code จาก GitHub
   - Install dependencies
   - Run database migrations
   - Start the application

## ✅ Post-deployment

### 1. ตรวจสอบ Health Check
เข้า: `https://<your-app-name>.onrender.com/health`

ควรเห็น:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### 2. ทดสอบเกม
เข้า: `https://<your-app-name>.onrender.com`

### 3. ตรวจสอบ Database
- เข้า Render Dashboard → PostgreSQL
- ดู **Logs** ว่า migrations สำเร็จ

## 🐛 Troubleshooting

### Database Connection Error
```bash
# ดู logs ที่ Render Dashboard
# ตรวจสอบ DATABASE_URL ว่าถูกต้อง
```

### Build Failed
```bash
# ตรวจสอบ package.json
# ดู build logs ใน Render
```

### App ไม่ start
```bash
# ตรวจสอบ Start Command: npm start
# ดู Environment Variables
```

## 📊 Monitoring

### 1. Render Dashboard
- **Metrics**: CPU, Memory usage
- **Logs**: Real-time application logs
- **Events**: Deploy history

### 2. Application Health
- Health check: `/health`
- แจ้งเตือนอัตโนมัติใน Render

## 🔄 Updates

### Auto-Deploy
Render จะ deploy อัตโนมัติเมื่อ push ไปยัง GitHub

### Manual Deploy
1. Render Dashboard → Service
2. คลิก **Manual Deploy**
3. เลือก branch

## 💡 Performance Tips

### 1. Cold Start
- Free tier มี cold start (ปิดเมื่อไม่ใช้ 15 นาที)
- ใช้ uptime monitor เพื่อ keep alive

### 2. Database Optimization
- ใช้ connection pooling (ใน code แล้ว)
- Monitor slow queries

### 3. Static Assets
- CSS/JS ถูก serve จาก Express
- พิจารณาใช้ CDN สำหรับ production

## 🎯 Custom Domain (Optional)

1. Render Dashboard → Settings
2. **Custom Domains**
3. เพิ่ม domain name
4. ตั้งค่า DNS records

## 🔒 Security Checklist

- ✅ JWT_SECRET ไม่เผยแพร่
- ✅ DATABASE_URL ปลอดภัย
- ✅ CORS ตั้งค่าถูกต้อง
- ✅ HTTPS อัตโนมัติจาก Render
- ✅ Rate limiting เปิดใช้งาน

## 📞 Support

หากมีปัญหา:
1. ตรวจสอบ Render logs
2. ดู GitHub issues: render.com/docs
3. Community: render.com/community

---

🎉 **เรียบร้อย!** เกม Kahoo พร้อมใช้งานบน Render แล้ว!