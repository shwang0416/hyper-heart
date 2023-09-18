const throttle = require('lodash.throttle')

// Constants for the particle simulation.
const PALE_PINK = [255, 168, 213]
const BLUE = [66, 135, 245]
const GREEN = [105, 255, 117]
const YELLOW = [255, 233, 69]
const VIOLET = [177, 135, 255]
const COLORS = [PALE_PINK, BLUE, GREEN, YELLOW, VIOLET]

const MAX_PARTICLES = 500
const PARTICLE_ALPHA_FADEOUT = 0.97
const PARTICLE_ALPHA_MIN_THRESHOLD = 0.1

// Our extension's custom redux middleware. Here we can intercept redux actions and respond to them.
exports.middleware = (store) => (next) => (action) => {
	// the redux `action` object contains a loose `type` string, the
	// 'SESSION_ADD_DATA' type identifier corresponds to an action in which
	// the terminal wants to output information to the GUI.
	if ('SESSION_ADD_DATA' === action.type) {
		// 'SESSION_ADD_DATA' actions hold the output text data in the `data` key.
		const { data } = action
		if (detectWowCommand(data)) {
			// Here, we are responding to 'wow' being input at the prompt. Since we don't
			// want the "unknown command" output being displayed to the user, we don't thunk the next
			// middleware by calling `next(action)`. Instead, we dispatch a new action 'WOW_MODE_TOGGLE'.
			store.dispatch({
				type: 'WOW_MODE_TOGGLE',
			})
		} else {
			next(action)
		}
	} else {
		next(action)
	}
}

// This function performs regex matching on expected shell output for 'wow' being input
// at the command line. Currently it supports output from bash, zsh, fish, cmd and powershell.
function detectWowCommand(data) {
	const patterns = [
		'wow: command not found',
		'command not found: wow',
		"Unknown command 'wow'",
		"'wow' is not recognized*",
		"'wow'은\\(는\\) 내부 또는 외부 명령.*",
	]
	return new RegExp('(' + patterns.join(')|(') + ')').test(data)
}

// Our extension's custom ui state reducer. Here we can listen for our 'WOW_MODE_TOGGLE' action
// and modify the state accordingly.
exports.reduceUI = (state, action) => {
	switch (action.type) {
		case 'WOW_MODE_TOGGLE':
			// Toggle wow mode!
			return state.set('wowMode', !state.wowMode)
	}
	return state
}

// Our extension's state property mapper. Here we can pass the ui's `wowMode` state
// into the terminal component's properties.
exports.mapTermsState = (state, map) => {
	return Object.assign(map, {
		wowMode: state.ui.wowMode,
	})
}

// We'll need to handle reflecting the `wowMode` property down through possible nested
// parent/children terminal hierarchies.
const passProps = (uid, parentProps, props) => {
	return Object.assign(props, {
		wowMode: parentProps.wowMode,
	})
}

exports.getTermGroupProps = passProps
exports.getTermProps = passProps

// The `decorateTerm` hook allows our extension to return a higher order react component.
// It supplies us with:
// - Term: The terminal component.
// - React: The enture React namespace.
// - notify: Helper function for displaying notifications in the operating system.
//
// The portions of this code dealing with the particle simulation are heavily based on:
// - https://atom.io/packages/power-mode
// - https://github.com/itszero/rage-power/blob/master/index.jsx
exports.decorateTerm = (Term, { React, notify }) => {
	// Define and return our higher order component.
	return class extends React.Component {
		constructor(props, context) {
			super(props, context)
			// Since we'll be passing these functions around, we need to bind this
			// to each.
			this._drawFrame = this._drawFrame.bind(this)
			this._resizeCanvas = this._resizeCanvas.bind(this)
			this._onDecorated = this._onDecorated.bind(this)
			this._onCursorMove = this._onCursorMove.bind(this)
			this._spawnParticles = throttle(
				this._spawnParticles.bind(this),
				25,
				{ trailing: false }
			)
			// Initial particle state
			this._particles = []
			this.heartMatrix = [
				'0^^00^^0',
				'<<^^^^>>',
				'<<^^^^>>',
				'0<<vv>>0',
				'00<vv>00',
				'000vv000',
			]
			this.heartMatrix2 = [
				'001100001100',
				'011110011110',
				'111111111111',
				'011111111110',
				'001111111100',
				'000111111100',
				'000011111000',
				'000001110000',
				'000000100000',
			]
			this.heartMatrix3 = [
				'0000110000110000',
				'0011111001111100',
				'1111111111111111',
				'1111111111111111',
				'0111111111111110',
				'0001111111111100',
				'0000011111110000',
				'0000001111100000',
				'0000000111000000',
				'0000000010000000',
			]
			this._heartSpiralParticles = []
			// this.blinkMatrix1 = [
			// 	'000010000',
			// 	'000010000',
			// 	'000010000',
			// 	'000111000',
			// 	'111111111',
			// 	'000111000',
			// 	'000010000',
			// 	'000010000',
			// 	'000010000',
			// ]
			// We'll set these up when the terminal is available in `_onDecorated`
			this._div = null
			this._canvas = null
		}

		_onDecorated(term) {
			if (this.props.onDecorated) this.props.onDecorated(term)
			this._div = term ? term.termRef : null
			this._initCanvas()
		}

		// Set up our canvas element we'll use to do particle effects on.
		_initCanvas() {
			this._canvas = document.createElement('canvas')
			this._canvas.style.position = 'absolute'
			this._canvas.style.top = '0'
			this._canvas.style.pointerEvents = 'none'
			this._canvasContext = this._canvas.getContext('2d')
			this._canvas.width = window.innerWidth
			this._canvas.height = window.innerHeight
			document.body.appendChild(this._canvas)
			window.requestAnimationFrame(this._drawFrame)
			window.addEventListener('resize', this._resizeCanvas)
		}

		_resizeCanvas() {
			this._canvas.width = window.innerWidth
			this._canvas.height = window.innerHeight
		}

		// Draw the next frame in the particle simulation.
		_drawFrame() {
			this._heartSpiralParticles.length &&
				this._canvasContext.clearRect(
					0,
					0,
					this._canvas.width,
					this._canvas.height
				)

			this._heartSpiralParticles.forEach((particle) => {
				particle.radius += 0.4 // 조절 가능한 값입니다.
				particle.angle += 0.1 // 조절 가능한 값입니다.
				particle.alpha *= PARTICLE_ALPHA_FADEOUT

				if (particle.alpha > PARTICLE_ALPHA_MIN_THRESHOLD) {
					// 하트 하나 그리기

					this._canvasContext.fillStyle = `rgba(${particle.color.join(
						','
					)}, ${particle.alpha})`

					const matrix =
						particle.size === 0
							? this.heartMatrix
							: particle.size === 1
							? this.heartMatrix2
							: this.heartMatrix3

					for (let i = 0; i < matrix.length; i++) {
						for (let j = 0; j < matrix[i].length; j++) {
							const arrow = matrix[i][j]
							if (arrow !== '0') {
								this._canvasContext.fillRect(
									j +
										particle.x +
										particle.radius *
											Math.cos(particle.angle),
									i +
										particle.y +
										particle.radius *
											Math.sin(particle.angle),
									1,
									1
								)
							}
						}
					}
				}
			})

			this._heartSpiralParticles = this._heartSpiralParticles
				.slice(
					Math.max(
						this._heartSpiralParticles.length - MAX_PARTICLES,
						0
					)
				)
				.filter(
					(particle) => particle.alpha > PARTICLE_ALPHA_MIN_THRESHOLD
				)
			if (
				this._heartSpiralParticles.length > 0 ||
				this.props.needsRedraw
			) {
				window.requestAnimationFrame(this._drawFrame)
			}
			this.props.needsRedraw = this._heartSpiralParticles.length === 0
		}
		_generateRandomNumber() {
			const randomNumber = Math.random()
			if (randomNumber < 0.25) {
				return 1
			} else if (randomNumber > 0.9) {
				return 2
			} else {
				return 0
			}
		}
		// Pushes `PARTICLE_NUM_RANGE` new particles into the simulation.
		_spawnParticles(x, y) {
			const length = this._heartSpiralParticles.length

			const randomColorIndex = Math.floor(Math.random() * COLORS.length)
			const size = this._generateRandomNumber()
			this._heartSpiralParticles.push(
				this._createSpiralParticle(x, y, size, COLORS[randomColorIndex])
			)

			// 왜 this._heartSpiralParticles.length === 0 이면 다시 그릴까?
			if (length === 0) {
				window.requestAnimationFrame(this._drawFrame)
			}
		}

		// Returns a particle of a specified color
		// at some random offset from the input coordinates.
		_createSpiralParticle(x, y, size, color) {
			return {
				x,
				y,
				size,
				alpha: 1,
				color,
				radius: 30,
				angle: Math.PI,
			}
		}
		_onCursorMove(cursorFrame) {
			if (this.props.onCursorMove) this.props.onCursorMove(cursorFrame)

			const { x, y } = cursorFrame
			// const origin = this._div.getBoundingClientRect()

			requestAnimationFrame(() => {
				this._spawnParticles(x + 20, y + 50)
			})
		}

		// Called when the props change, here we'll check if wow mode has gone
		// on -> off or off -> on and notify the user accordingly.
		componentWillReceiveProps(next) {
			if (next.wowMode && !this.props.wowMode) {
				notify('WOW such on')
			} else if (!next.wowMode && this.props.wowMode) {
				notify('WOW such off')
			}
		}

		render() {
			// Return the default Term component with our custom onTerminal closure
			// setting up and managing the particle effects.
			return React.createElement(
				Term,
				Object.assign({}, this.props, {
					onDecorated: this._onDecorated,
					onCursorMove: this._onCursorMove,
				})
			)
		}

		componentWillUnmount() {
			document.body.removeChild(this._canvas)
		}
	}
}
