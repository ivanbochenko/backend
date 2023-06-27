import { Elysia, t } from "elysia"
import { PrismaClient } from '@prisma/client'
import { jwt } from '@elysiajs/jwt'
import { v4 as uuid } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { queryRoute } from "./queries"
import { mutationRoute } from "./mutations"
import { loginRoute } from "./login"
import { passwordRoute } from "./password";

const client = new PrismaClient()

const s3 = new S3Client({
  region: "eu-central-1",
  logger: console,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
})

export const setdb = (app: Elysia) => app.decorate("db", client)

export const auth = async (app: Elysia) => app
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )
  .derive(async ({ request: { headers }, jwt }) => {
    const auth = headers.get('Authorization') ?? undefined
    const payload = await jwt.verify(auth)
    if (!payload) throw Error('Unauthorized')
    return { id: payload.id }
  })

// const upload = async (file: Blob, id: string) => 

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(setdb)
  .use(loginRoute)
  .use(passwordRoute)
  .use(auth)
  .use(queryRoute)
  .use(mutationRoute)
	.post('/photo',
    async ({ body: { file }, id }) => {
      const Bucket = "onlyfriends-bucket"
      const Key = `${id}/${uuid()}`
      const Expires = new Date(new Date().setMonth(new Date().getMonth() + 2))
      const Body = Buffer.from(await file.arrayBuffer())
      const command = new PutObjectCommand({
        Bucket,
        Key,
        Expires,
        Body,
        ContentType: file.type,
      })
      await s3.send(command)
      return process.env.AWS_S3_LINK! + '/' + Key
    },
    {
      body: t.Object({
        file: t.File()
      })
	  }
  )
  .listen(3000);

export type App = typeof app

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);