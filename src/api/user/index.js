import alova from '@/api/index.js'

export function postUserLogin(data) {
  return alova.Post('/auth/sign-in', data)
}

export function postAuthOtp(data) {
  return alova.Post('/auth/otp', data)
}

export function getUserInfo() {
  return alova.Get('/user/info')
}
