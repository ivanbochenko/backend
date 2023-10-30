import { Elysia, t } from "elysia"
import { v4 as uuid } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
})

export const photoRoute = new Elysia()
  .post('/photo/:id',
    async ({ body: { file }, params: { id } }) => {
      const Bucket = "onlyfriends-bucket"
      const Key = `${id}/${uuid()}`
      const Expires = new Date(new Date().setMonth(new Date().getMonth() + 2))
      const Body = Buffer.from(await file.arrayBuffer())
      const command = new PutObjectCommand({
        Bucket,
        Key,
        Expires,
        Body: file.stream(),
        ContentType: file.type,
      })
      try {
        await s3.send(command)
        return `https://${Bucket}.s3.${region}.amazonaws.com/${Key}`
      } catch (error) {
        console.log(error)
        return null
      }
    },
    {
      body: t.Object({
        file: t.File()
      })
    }
  )