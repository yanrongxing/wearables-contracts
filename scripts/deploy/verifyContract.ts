import hr from 'hardhat'

async function main() {
  await hr.run("verify:verify", {
    address: '0xe18B1361d41afC44658216F3Dc27e48c2336e3c2',
    constructorArguments: [
      '0xc002A074c59DD45dDb52334f2ef8fb743A579c89',
      [
        '0x8Cff6832174091DAe86F0244e3Fd92d4CeD2Fe07', '0xeDaE96F7739aF8A7fB16E2a888C1E578E1328299', '0x24e5F44999c151f08609F8e27b2238c773C4D020', '0x9dB59920d3776c2d8A3aA0CbD7b16d81FcAb0A2b', '0x967fB0c36e4f5288F30Fb05F8B2a4d7B77eaca4B', '0xeF38F892E4722152fD8eDb50cD84a96344FD47Ce', '0x0de1ec708665b93478bd0ed264e60b68a8663bb4', '0x1D9aa2025b67f0F21d1603ce521bda7869098f8a', '0x87956abC4078a0Cc3b89b419928b857B8AF826Ed', '0xA8D82B0BF686EEe78EB5eC882cac98FdD1335EF5', '0x598f8af1565003AE7456DaC280a18ee826Df7a2c', '0x91e222Ed7598eFBCFE7190481f2fd14897E168c8', '0x474543b99438A978b39D39D8983723Eb5fF9196b', '0x7E6d4810eA233d7588E3675d704571e29C4BCbBa', '0xcE62a8b133C64192a0ddB7dAbc172332f4629f42', '0x4C21f36E5E12974311d21a3E6d79CdAbe36c3C9f', '0x05C351382dB8D770207F319D96ac1184c3717edE', '0x3e89930d429404c59Df3607670Ee6c9c35D6d2fE'
      ]
    ],
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })