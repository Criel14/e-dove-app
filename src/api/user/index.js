import alova from '@/api/index.js'

export function postUserLogin(data) {
  return alova.Post('/auth/sign-in', data)
}

export function postAuthOtp(data) {
  return alova.Post('/auth/otp', data)
}

export function postUserRegister(data) {
  return alova.Post('/auth/register', data)
}

export function getUserInfo() {
  return alova.Get('/user/info')
}

export function putUserUpdate(data) {
  return alova.Put('/user/update', data)
}
