import { Elysia, t } from "elysia"
import { auth, setdb } from "."

export const passwordRoute = (app: Elysia) => app
  .use(setdb)
  .use(auth)
  .group(
    '/password', {
      body: t.Object({
        password: t.String()
      })
    }, 
    app => app
      .derive(async ({ body: { password }, id, db }) => {
        const hash = (await db.user.findUnique({ where: { id }, select: { password: true} }))?.password
        if (!hash) throw Error('No such user')
        const isCorrectPassword = await Bun.password.verify(password, hash)
        if (!isCorrectPassword) throw Error('Unauthorized')
      })
      .post('/reset',
        async ({body: { newPassword }, db, id}) => db.user.update({
          where: { id },
          data: { password: await Bun.password.hash(newPassword) }
        }),
        {
          body: t.Object({
            password: t.String(),
            newPassword: t.String()
          })
        }
      )
      .post('/user/delete',
        async ({db, id}) => db.user.delete({ where: { id } })
      )
  )