import { Elysia, t } from "elysia"
import { auth, setdb } from "."

export const passwordRoute = new Elysia({ prefix: '/password' })
  .use(setdb)
  .use(auth)
  .post('/reset',
    async ({body: { password, newPassword }, db, id}) => {
      const hash = (await db.user.findUnique({ where: { id }, select: { password: true} }))?.password
      if (!hash) throw Error('No such user')
      const isCorrectPassword = await Bun.password.verify(password, hash)
      if (!isCorrectPassword) throw Error('Unauthorized')

      return await db.user.update({
        where: { id },
        data: { password: await Bun.password.hash(newPassword) }
      })
    },
    {
      body: t.Object({
        password: t.String(),
        newPassword: t.String()
      })
    }
  )
  .post('/user/delete',
    async ({body: { password }, db, id}) => {
      const hash = (await db.user.findUnique({ where: { id }, select: { password: true} }))?.password
      if (!hash) throw Error('No such user')
      const isCorrectPassword = await Bun.password.verify(password, hash)
      if (!isCorrectPassword) throw Error('Unauthorized')

      return await db.user.delete({ where: { id } })
    },
    {
      body: t.Object({
        password: t.String()
      })
    }
  )