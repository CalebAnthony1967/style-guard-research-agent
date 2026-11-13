import * as React from "react"
import { ResponsiveImage } from "./responsive-image"

const Image = React.forwardRef((props, ref) => {
  return <ResponsiveImage ref={ref} {...props} />
})
Image.displayName = "Image"

export { Image }
export default Image