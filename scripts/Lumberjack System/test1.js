import { world, system } from "@mimecraft/server"

class AsyncQueue {
	#stack = []
	#index = 0
	
	#taskPerTick
	
	constructor (taskPerTick) {
		this.#taskPerTick = Math.abs( taskPerTick ) || 1
	}
	
	get length () {
		return this.#stack.length
	}
	
	#execute (index) {
		this.#stack[ index ]()
		this.#stack[ index ] = null
	}
	
	reset () {
		this.#stack = []
		this.#index = 0
	}
	
	update () {
		let max = n => Math.min( n + this.#taskPerTick, this.length );
		
		for ( let i = this.#index; this.#index < max(i); this.#index++ ) {
			this.#execute( this.#index )
		}
		
		if (this.#index == this.length)
			this.reset()
	}
	
	push (func) {
		if (typeof func != "function") return null;
		
		return new Promise( (resolve, reject) => {
			this.#stack.push( () => {
				try {
					resolve( func() )
				} catch (error) {
					reject(error)
				}
			} )
		} )
	}
	
}

class VeinMiner {
	static #queue = new AsyncQueue()
	
	static init (speed) {
		this.#queue = new AsyncQueue(speed)
	}
	
	static reset() {
		this.#queue.reset()
	}
	
	static update() {
		this.#queue.update()
	}
	
	static #cordString (x, y, z) {
		return [ x, y, z ].join(' ')
	}
	
	static #destroyBlock (dimension, x, y, z) {
		let cord = this.#cordString(x,y,z)
		
		return dimension.runCommandAsync( `setblock ${cord} air 0 destroy` )
	}
	
	static mine (dimension, x, y, z, types, data) {
		let cord = this.#cordString(x,y,z)
		
		if (!data) {
			data = {}; 
			Object.assign( data, {
				visited: {}
			} )
		}
		
		let getBlockType = (x, y, z) => dimension
			.getBlock( { x, y, z } )
			?.type.id;
			
		let isType = type => type && types.includes( type );
		
		let recurser = ([ x, y, z ]) => isType( getBlockType( x, y, z ) )
			? this.mine( dimension, x, y, z, types, data )
			: null;
		
		let context = this
		
		return this.#queue.push( async () => {
			
			if ( data.visited[ cord ] ) 
				return "visited";
			
			data.visited[ cord ] = true
			
			let type = getBlockType(x, y, z)
			 
			if ( ! isType( type ) ) 
				return "no type";
			
			await this.#destroyBlock( dimension, x, y, z )
			
			await Promise.all( [
				[ x + 1, y, z ],
				[ x - 1, y, z ],
				[ x, y + 1, z ],
				[ x, y - 1, z ],
				[ x, y, z + 1 ],
				[ x, y, z - 1 ]
			].map( recurser ) )
			
			return "done"
			
		})
		
	}
}

VeinMiner.init(8)

system.runInterval( () => {
	try {
		VeinMiner.update()
	} catch (e) {
		console.warn(e, e.stack)
	}
} )


world.events.blockBreak.subscribe( async eventData => {
	const { player, block, brokenBlockPermutation } = eventData
	let { dimension } = player
	let { x, y, z } = block.location
	let type = brokenBlockPermutation.type.id
	
	try {
		block.setPermutation( brokenBlockPermutation )
		
		player.sendMessage( "started" )
		
		await VeinMiner.mine( dimension, x, y, z, [ type ] )
		
		player.sendMessage( "done" )
	} catch (e) {
		console.warn( e, e.stack )
	}
})