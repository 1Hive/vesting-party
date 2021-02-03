import { expect } from 'chai'
import { BigNumber, constants, Signer } from 'ethers'
import hre, { waffle, ethers } from 'hardhat'
import { Artifact } from 'hardhat/types'
import BalanceTree from '../src/balance-tree'
import { parseBalanceMap } from '../src/parse-balance-map'
import { MerkleDistributor, TestERC20 } from '../typechain'

const { deployContract } = waffle

const overrides = {
  gasLimit: 9500000,
}

const ZERO_BYTES32 = `0x${'00'.repeat(32)}`

const getEthersSignersAddresses = async (): Promise<string[]> =>
  await Promise.all((await ethers.getSigners()).map((signer) => signer.getAddress()))

describe('MerkleDistributor', () => {
  let wallets: Signer[]
  let wallet0: Signer
  let addresses: string[]

  let TestERC20: Artifact, Distributor: Artifact
  let token: TestERC20

  before(async () => {
    wallets = await ethers.getSigners()
    ;[wallet0] = wallets
    addresses = await getEthersSignersAddresses()
    TestERC20 = await hre.artifacts.readArtifact('TestERC20')
    Distributor = await hre.artifacts.readArtifact('MerkleDistributor')
  })

  beforeEach('deploy token', async () => {
    token = (await deployContract(wallet0, TestERC20, ['Token', 'TKN', 0], overrides)) as TestERC20
  })

  describe('#token', () => {
    it('returns the token address', async () => {
      const distributor = (await deployContract(
        wallet0,
        Distributor,
        [token.address, ZERO_BYTES32],
        overrides
      )) as MerkleDistributor
      expect(await distributor.token()).to.eq(token.address)
    })
  })

  describe('#merkleRoot', () => {
    it('returns the zero merkle root', async () => {
      const distributor = (await deployContract(
        wallet0,
        Distributor,
        [token.address, ZERO_BYTES32],
        overrides
      )) as MerkleDistributor
      expect(await distributor.merkleRoot()).to.eq(ZERO_BYTES32)
    })
  })

  describe('#claim', () => {
    it('fails for empty proof', async () => {
      const distributor = (await deployContract(
        wallet0,
        Distributor,
        [token.address, ZERO_BYTES32],
        overrides
      )) as MerkleDistributor
      await expect(distributor.claim(0, addresses[0], 10, [])).to.be.revertedWith('MerkleDistributor: Invalid proof.')
    })

    it('fails for invalid index', async () => {
      const distributor = (await deployContract(
        wallet0,
        Distributor,
        [token.address, ZERO_BYTES32],
        overrides
      )) as MerkleDistributor
      await expect(distributor.claim(0, addresses[0], 10, [])).to.be.revertedWith('MerkleDistributor: Invalid proof.')
    })

    describe('two account tree', () => {
      let distributor: MerkleDistributor
      let tree: BalanceTree
      beforeEach('deploy', async () => {
        tree = new BalanceTree([
          { account: addresses[0], amount: BigNumber.from(100) },
          { account: addresses[1], amount: BigNumber.from(101) },
        ])
        distributor = (await deployContract(
          wallet0,
          Distributor,
          [token.address, tree.getHexRoot()],
          overrides
        )) as MerkleDistributor
        await token.setBalance(distributor.address, 201)
      })

      it('successful claim', async () => {
        const proof0 = tree.getProof(0, addresses[0], BigNumber.from(100))
        await expect(distributor.claim(0, addresses[0], 100, proof0, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(0, addresses[0], 100)
        const proof1 = tree.getProof(1, addresses[1], BigNumber.from(101))
        await expect(distributor.claim(1, addresses[1], 101, proof1, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(1, addresses[1], 101)
      })

      it('sets #isClaimed', async () => {
        const proof0 = tree.getProof(0, addresses[0], BigNumber.from(100))
        expect(await distributor.isClaimed(0)).to.eq(false)
        expect(await distributor.isClaimed(1)).to.eq(false)
        await distributor.claim(0, addresses[0], 100, proof0, overrides)
        expect(await distributor.isClaimed(0)).to.eq(true)
        expect(await distributor.isClaimed(1)).to.eq(false)
      })

      it('cannot allow two claims', async () => {
        const proof0 = tree.getProof(0, addresses[0], BigNumber.from(100))
        await distributor.claim(0, addresses[0], 100, proof0, overrides)
        await expect(distributor.claim(0, addresses[0], 100, proof0, overrides)).to.be.revertedWith(
          'MerkleDistributor: Drop already claimed.'
        )
      })

      it('cannot claim more than once: 0 and then 1', async () => {
        await distributor.claim(0, addresses[0], 100, tree.getProof(0, addresses[0], BigNumber.from(100)), overrides)
        await distributor.claim(1, addresses[1], 101, tree.getProof(1, addresses[1], BigNumber.from(101)), overrides)

        await expect(
          distributor.claim(0, addresses[0], 100, tree.getProof(0, addresses[0], BigNumber.from(100)), overrides)
        ).to.be.revertedWith('MerkleDistributor: Drop already claimed.')
      })

      it('cannot claim more than once: 1 and then 0', async () => {
        await distributor.claim(1, addresses[1], 101, tree.getProof(1, addresses[1], BigNumber.from(101)), overrides)
        await distributor.claim(0, addresses[0], 100, tree.getProof(0, addresses[0], BigNumber.from(100)), overrides)

        await expect(
          distributor.claim(1, addresses[1], 101, tree.getProof(1, addresses[1], BigNumber.from(101)), overrides)
        ).to.be.revertedWith('MerkleDistributor: Drop already claimed.')
      })

      it('cannot claim for address other than proof', async () => {
        const proof0 = tree.getProof(0, addresses[0], BigNumber.from(100))
        await expect(distributor.claim(1, addresses[1], 101, proof0, overrides)).to.be.revertedWith(
          'MerkleDistributor: Invalid proof.'
        )
      })

      it('cannot claim more than proof', async () => {
        const proof0 = tree.getProof(0, addresses[0], BigNumber.from(100))
        await expect(distributor.claim(0, addresses[0], 101, proof0, overrides)).to.be.revertedWith(
          'MerkleDistributor: Invalid proof.'
        )
      })

      it('gas [ @skip-on-coverage ]', async () => {
        const proof = tree.getProof(0, addresses[0], BigNumber.from(100))
        const tx = await distributor.claim(0, addresses[0], 100, proof, overrides)
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(47237)
      })
    })

    describe('larger tree', () => {
      let distributor: MerkleDistributor
      let tree: BalanceTree
      beforeEach('deploy', async () => {
        tree = new BalanceTree(
          addresses.map((address, ix) => {
            return {
              account: address,
              amount: BigNumber.from(ix + 1),
            }
          })
        )
        distributor = (await deployContract(
          wallet0,
          Distributor,
          [token.address, tree.getHexRoot()],
          overrides
        )) as MerkleDistributor
        await token.setBalance(distributor.address, 201)
      })

      it('claim index 4', async () => {
        const proof = tree.getProof(4, addresses[4], BigNumber.from(5))
        await expect(distributor.claim(4, addresses[4], 5, proof, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(4, addresses[4], 5)
      })

      it('claim index 9', async () => {
        const proof = tree.getProof(9, addresses[9], BigNumber.from(10))
        await expect(distributor.claim(9, addresses[9], 10, proof, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(9, addresses[9], 10)
      })

      it('gas [ @skip-on-coverage ]', async () => {
        const proof = tree.getProof(9, addresses[9], BigNumber.from(10))
        const tx = await distributor.claim(9, addresses[9], 10, proof, overrides)
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(50529)
      })

      it('gas second down about 15k [ @skip-on-coverage ]', async () => {
        await distributor.claim(0, addresses[0], 1, tree.getProof(0, addresses[0], BigNumber.from(1)), overrides)
        const tx = await distributor.claim(
          1,
          addresses[1],
          2,
          tree.getProof(1, addresses[1], BigNumber.from(2)),
          overrides
        )
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(35529)
      })
    })

    describe('realistic size tree', () => {
      let distributor: MerkleDistributor
      let tree: BalanceTree
      const NUM_LEAVES = 100_000
      const NUM_SAMPLES = 25
      const elements: { account: string; amount: BigNumber }[] = []

      before(async () => {
        for (let i = 0; i < NUM_LEAVES; i++) {
          const node = {
            account: addresses[0],
            amount: BigNumber.from(100),
          }
          elements.push(node)
        }
        tree = new BalanceTree(elements)
      })

      it('proof verification works', () => {
        const root = Buffer.from(tree.getHexRoot().slice(2), 'hex')
        for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
          const proof = tree.getProof(i, addresses[0], BigNumber.from(100)).map((el) => Buffer.from(el.slice(2), 'hex'))
          const validProof = BalanceTree.verifyProof(i, addresses[0], BigNumber.from(100), proof, root)
          expect(validProof).to.be.true
        }
      })

      beforeEach('deploy', async () => {
        distributor = (await deployContract(
          wallet0,
          Distributor,
          [token.address, tree.getHexRoot()],
          overrides
        )) as MerkleDistributor
        await token.setBalance(distributor.address, constants.MaxUint256)
      })

      it('gas [ @skip-on-coverage ]', async () => {
        const proof = tree.getProof(50000, addresses[0], BigNumber.from(100))
        const tx = await distributor.claim(50000, addresses[0], 100, proof, overrides)
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(60383)
      })
      it('gas deeper node [ @skip-on-coverage ]', async () => {
        const proof = tree.getProof(90000, addresses[0], BigNumber.from(100))
        const tx = await distributor.claim(90000, addresses[0], 100, proof, overrides)
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(60435)
      })
      it('gas average random distribution [ @skip-on-coverage ]', async () => {
        let total: BigNumber = BigNumber.from(0)
        let count: number = 0
        for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
          const proof = tree.getProof(i, addresses[0], BigNumber.from(100))
          const tx = await distributor.claim(i, addresses[0], 100, proof, overrides)
          const receipt = await tx.wait()
          total = total.add(receipt.gasUsed)
          count++
        }
        const average = total.div(count)
        expect(average).to.eq(60242)
      })
      // this is what we gas golfed by packing the bitmap
      it('gas average first 25 [ @skip-on-coverage ]', async () => {
        let total: BigNumber = BigNumber.from(0)
        let count: number = 0
        for (let i = 0; i < 25; i++) {
          const proof = tree.getProof(i, addresses[0], BigNumber.from(100))
          const tx = await distributor.claim(i, addresses[0], 100, proof, overrides)
          const receipt = await tx.wait()
          total = total.add(receipt.gasUsed)
          count++
        }
        const average = total.div(count)
        expect(average).to.eq(45989)
      })

      it('no double claims in random distribution', async () => {
        for (let i = 0; i < 25; i += Math.floor(Math.random() * (NUM_LEAVES / NUM_SAMPLES))) {
          const proof = tree.getProof(i, addresses[0], BigNumber.from(100))
          await distributor.claim(i, addresses[0], 100, proof, overrides)
          await expect(distributor.claim(i, addresses[0], 100, proof, overrides)).to.be.revertedWith(
            'MerkleDistributor: Drop already claimed.'
          )
        }
      })
    })
  })

  describe('parseBalanceMap', () => {
    let distributor: MerkleDistributor
    let claims: {
      [account: string]: {
        index: number
        amount: string
        proof: string[]
      }
    }
    beforeEach('deploy', async () => {
      const { claims: innerClaims, merkleRoot, tokenTotal } = parseBalanceMap({
        [addresses[0]]: 200,
        [addresses[1]]: 300,
        [addresses[2]]: 250,
      })
      expect(tokenTotal).to.eq('0x02ee') // 750
      claims = innerClaims
      distributor = (await deployContract(
        wallet0,
        Distributor,
        [token.address, merkleRoot],
        overrides
      )) as MerkleDistributor
      await token.setBalance(distributor.address, tokenTotal)
    })

    it('check the proofs is as expected [ @skip-on-coverage ]', () => {
      expect(claims).to.deep.eq({
        [addresses[0]]: {
          index: 2,
          amount: '0xc8',
          proof: [
            '0x0782528e118c4350a2465fbeabec5e72fff06991a29f21c08d37a0d275e38ddd',
            '0xf3c5acb53398e1d11dcaa74e37acc33d228f5da944fbdea9a918684074a21cdb',
          ],
        },
        [addresses[1]]: {
          index: 1,
          amount: '0x012c',
          proof: [
            '0xc86fd316fa3e7b83c2665b5ccb63771e78abcc0429e0105c91dde37cb9b857a4',
            '0xf3c5acb53398e1d11dcaa74e37acc33d228f5da944fbdea9a918684074a21cdb',
          ],
        },
        [addresses[2]]: {
          index: 0,
          amount: '0xfa',
          proof: ['0x0c9bcaca2a1013557ef7f348b514ab8a8cd6c7051b69e46b1681a2aff22f4a88'],
        },
      })
    })

    it('all claims work exactly once', async () => {
      for (let account in claims) {
        const claim = claims[account]
        await expect(distributor.claim(claim.index, account, claim.amount, claim.proof, overrides))
          .to.emit(distributor, 'Claimed')
          .withArgs(claim.index, account, claim.amount)
        await expect(distributor.claim(claim.index, account, claim.amount, claim.proof, overrides)).to.be.revertedWith(
          'MerkleDistributor: Drop already claimed.'
        )
      }
      // TODO move to Offer
      // expect(await token.balanceOf(distributor.address)).to.eq(0);
    })
  })
})
