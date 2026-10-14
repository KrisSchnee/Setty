import { runCameraSelfTest } from './camera.ts'
import { runColorSelfTest } from './color.ts'
import { runCoordsSelfTest } from './coords.ts'
import { runSelfTest } from './mapState.ts'
import { runStillSelfTest } from './still.ts'
import { runViewportSelfTest } from './viewport3d.ts'

runCoordsSelfTest()
runColorSelfTest()
runCameraSelfTest()
runSelfTest()
runViewportSelfTest()
runStillSelfTest()
console.log('self-test ok')
