"use client"

export default function TicTacToe() {

    return <div className="grid grid-cols-3 gap-6 w-full aspect-square bg-yellow-300">

        <TicTakToeBox />
        <TicTakToeBox />
        <TicTakToeBox />

        <TicTakToeBox />
        <TicTakToeBox />
        <TicTakToeBox />

        <TicTakToeBox />
        <TicTakToeBox />
        <TicTakToeBox />

    </div>
}

function TicTakToeBox() {
    return <div className="rounded-md w-full h-full bg-purple-400">

    </div>
}