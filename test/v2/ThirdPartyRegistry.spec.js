import hr from 'hardhat'
import { Mana } from 'decentraland-contract-plugins'

import assertRevert from '../helpers/assertRevert'
import { balanceSnap } from '../helpers/balanceSnap'
import {
  THIRD_PARTY_ITEMS,
  TIERS,
  getInitialTiers,
  ZERO_ADDRESS,
  ITEMS,
} from '../helpers/collectionV2'
import { sendMetaTx } from '../helpers/metaTx'

const Tiers = artifacts.require('Tiers')
const Committee = artifacts.require('Committee')
const ThirdPartyRegistry = artifacts.require('ThirdPartyRegistry')

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect
const domain = 'Decentraland Third Party Registry'
const version = '1'
const initialValueForThirdParties = true
const initialValueForItems = false

let thirdParty1
let thirdParty2

describe.only('ThirdPartyRegistry', function () {
  this.timeout(100000)

  // Accounts
  let accounts
  let deployer
  let user
  let manager
  let anotherManager
  let committeeMember
  let collector
  let hacker
  let relayer
  let owner
  let creator
  let fromUser
  let fromManager
  let fromAnotherManager
  let fromHacker
  let fromDeployer
  let fromRelayer
  let fromOwner
  let fromCommitteeMember

  // Contracts
  let tiersContract
  let committeeContract
  let manaContract
  let thirdPartyRegistryContract

  async function createMANA() {
    if (!manaContract) {
      const mana = new Mana({ accounts, artifacts: hr.artifacts })
      await mana.deploy({
        txParams: {
          ...fromOwner,
          gas: 9e6,
          gasPrice: 21e9,
        },
      })
      manaContract = mana.getContract()
    }
  }

  beforeEach(async function () {
    // Create Listing environment
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    manager = accounts[2]
    hacker = accounts[3]
    relayer = accounts[4]
    committeeMember = accounts[5]
    collector = accounts[6]
    owner = accounts[7]
    anotherManager = accounts[8]
    fromUser = { from: user }
    fromManager = { from: manager }
    fromHacker = { from: hacker }
    fromRelayer = { from: relayer }
    fromDeployer = { from: deployer }
    fromOwner = { from: owner }
    fromAnotherManager = { from: anotherManager }
    fromCommitteeMember = { from: committeeMember }

    await createMANA()

    committeeContract = await Committee.new(
      owner,
      [committeeMember],
      fromDeployer
    )

    tiersContract = await Tiers.new(deployer, getInitialTiers())

    thirdPartyRegistryContract = await ThirdPartyRegistry.new(
      owner,
      collector,
      committeeContract.address,
      manaContract.address,
      tiersContract.address,
      fromDeployer
    )

    thirdParty1 = [
      'urn:decentraland:matic:ext-thirdparty1',
      'tp:1:third party 1: the third party 1 desc',
      'https://api.thirdparty1.com/v1/',
      [manager],
      [],
    ]

    thirdParty2 = [
      'urn:decentraland:matic:ext-thirdparty2',
      'tp:1:third party 2: the third party 2 desc',
      'https://api.thirdparty2.com/v1/',
      [manager, anotherManager],
      [],
    ]
  })

  describe('initialize', function () {
    it('should be initialized with correct values', async function () {
      const contract = await ThirdPartyRegistry.new(
        owner,
        collector,
        committeeContract.address,
        manaContract.address,
        tiersContract.address,
        fromDeployer
      )

      const contractOwner = await contract.owner()
      expect(contractOwner).to.be.equal(owner)

      const feesCollector = await contract.feesCollector()
      expect(feesCollector).to.be.equal(collector)

      const committee = await contract.committee()
      expect(committee).to.be.equal(committeeContract.address)

      const mana = await contract.acceptedToken()
      expect(mana).to.be.equal(manaContract.address)

      const itemTiers = await contract.itemTiers()
      expect(itemTiers).to.be.equal(tiersContract.address)

      const thirdPartiesCount = await contract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const initialThirdPartyValue = await contract.initialThirdPartyValue()
      expect(initialThirdPartyValue).to.be.equal(initialValueForThirdParties)

      const initialItemValue = await contract.initialItemValue()
      expect(initialItemValue).to.be.equal(initialValueForItems)
    })
  })

  describe('setFeesCollector', async function () {
    it('should set feesCollector', async function () {
      let feesCollector = await thirdPartyRegistryContract.feesCollector()
      expect(feesCollector).to.be.equal(collector)

      let res = await thirdPartyRegistryContract.setFeesCollector(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('FeesCollectorSet')
      expect(logs[0].args._oldFeesCollector).to.be.equal(collector)
      expect(logs[0].args._newFeesCollector).to.be.equal(user)

      feesCollector = await thirdPartyRegistryContract.feesCollector()
      expect(feesCollector).to.be.equal(user)

      res = await thirdPartyRegistryContract.setFeesCollector(
        collector,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('FeesCollectorSet')
      expect(logs[0].args._oldFeesCollector).to.be.equal(user)
      expect(logs[0].args._newFeesCollector).to.be.equal(collector)

      feesCollector = await thirdPartyRegistryContract.feesCollector()
      expect(feesCollector).to.be.equal(collector)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the feesCollector', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setFeesCollector(ZERO_ADDRESS, fromOwner),
        'TPR#setFeesCollector: INVALID_FEES_COLLECTOR'
      )
    })

    it('reverts when trying to set a feesCollector by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setFeesCollector(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setAcceptedToken', async function () {
    it('should set acceptedToken', async function () {
      let acceptedToken = await thirdPartyRegistryContract.acceptedToken()
      expect(acceptedToken).to.be.equal(manaContract.address)

      let res = await thirdPartyRegistryContract.setAcceptedToken(
        user,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AcceptedTokenSet')
      expect(logs[0].args._oldAcceptedToken).to.be.equal(manaContract.address)
      expect(logs[0].args._newAcceptedToken).to.be.equal(user)

      acceptedToken = await thirdPartyRegistryContract.acceptedToken()
      expect(acceptedToken).to.be.equal(user)

      res = await thirdPartyRegistryContract.setAcceptedToken(
        manaContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('AcceptedTokenSet')
      expect(logs[0].args._oldAcceptedToken).to.be.equal(user)
      expect(logs[0].args._newAcceptedToken).to.be.equal(manaContract.address)

      acceptedToken = await thirdPartyRegistryContract.acceptedToken()
      expect(acceptedToken).to.be.equal(manaContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the acceptedToken', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setAcceptedToken(ZERO_ADDRESS, fromOwner),
        'TPR#setAcceptedToken: INVALID_ACCEPTED_TOKEN'
      )
    })

    it('reverts when trying to set a acceptedToken by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setAcceptedToken(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setCommittee', async function () {
    it('should set committee', async function () {
      let committee = await thirdPartyRegistryContract.committee()
      expect(committee).to.be.equal(committeeContract.address)

      let res = await thirdPartyRegistryContract.setCommittee(user, fromOwner)

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CommitteeSet')
      expect(logs[0].args._oldCommittee).to.be.equal(committeeContract.address)
      expect(logs[0].args._newCommittee).to.be.equal(user)

      committee = await thirdPartyRegistryContract.committee()
      expect(committee).to.be.equal(user)

      res = await thirdPartyRegistryContract.setCommittee(
        committeeContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('CommitteeSet')
      expect(logs[0].args._oldCommittee).to.be.equal(user)
      expect(logs[0].args._newCommittee).to.be.equal(committeeContract.address)

      committee = await thirdPartyRegistryContract.committee()
      expect(committee).to.be.equal(committeeContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the committee', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setCommittee(ZERO_ADDRESS, fromOwner),
        'TPR#setCommittee: INVALID_COMMITTEE'
      )
    })

    it('reverts when trying to set a committee by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setCommittee(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setItemTiers', async function () {
    it('should set itemTiers', async function () {
      let itemTiers = await thirdPartyRegistryContract.itemTiers()
      expect(itemTiers).to.be.equal(tiersContract.address)

      let res = await thirdPartyRegistryContract.setItemTiers(user, fromOwner)

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ItemTiersSet')
      expect(logs[0].args._oldItemTiers).to.be.equal(tiersContract.address)
      expect(logs[0].args._newItemTiers).to.be.equal(user)

      itemTiers = await thirdPartyRegistryContract.itemTiers()
      expect(itemTiers).to.be.equal(user)

      res = await thirdPartyRegistryContract.setItemTiers(
        tiersContract.address,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('ItemTiersSet')
      expect(logs[0].args._oldItemTiers).to.be.equal(user)
      expect(logs[0].args._newItemTiers).to.be.equal(tiersContract.address)

      itemTiers = await thirdPartyRegistryContract.itemTiers()
      expect(itemTiers).to.be.equal(tiersContract.address)
    })

    it('reverts when trying to set the ZERO_ADDRESS as the itemTiers', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setItemTiers(ZERO_ADDRESS, fromOwner),
        'TPR#setItemTiers: INVALID_ITEM_TIERS'
      )
    })

    it('reverts when trying to set a itemTiers by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setItemTiers(user, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setInitialThirdPartyValue', async function () {
    it('should set initial value for third parties', async function () {
      let initialValue =
        await thirdPartyRegistryContract.initialThirdPartyValue()
      expect(initialValue).to.be.equal(initialValueForThirdParties)

      let res = await thirdPartyRegistryContract.setInitialThirdPartyValue(
        !initialValueForThirdParties,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialThirdPartyValueSet')
      expect(logs[0].args._oldInitialThirdPartyValue).to.be.equal(
        initialValueForThirdParties
      )
      expect(logs[0].args._newInitialThirdPartyValue).to.be.equal(
        !initialValueForThirdParties
      )

      initialValue = await thirdPartyRegistryContract.initialThirdPartyValue()
      expect(initialValue).to.be.equal(!initialValueForThirdParties)

      res = await thirdPartyRegistryContract.setInitialThirdPartyValue(
        initialValueForThirdParties,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialThirdPartyValueSet')
      expect(logs[0].args._oldInitialThirdPartyValue).to.be.equal(
        !initialValueForThirdParties
      )
      expect(logs[0].args._newInitialThirdPartyValue).to.be.equal(
        initialValueForThirdParties
      )

      initialValue = await thirdPartyRegistryContract.initialThirdPartyValue()
      expect(initialValue).to.be.equal(initialValueForThirdParties)
    })

    it('reverts when trying to set the initial third party value by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setInitialThirdPartyValue(false, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('setInitialItemValue', async function () {
    it('should set initial value for items', async function () {
      let initialValue = await thirdPartyRegistryContract.initialItemValue()
      expect(initialValue).to.be.equal(initialValueForItems)

      let res = await thirdPartyRegistryContract.setInitialItemValue(
        !initialValueForItems,
        fromOwner
      )

      let logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialItemValueSet')
      expect(logs[0].args._oldInitialItemValue).to.be.equal(
        initialValueForItems
      )
      expect(logs[0].args._newInitialItemValue).to.be.equal(
        !initialValueForItems
      )

      initialValue = await thirdPartyRegistryContract.initialItemValue()
      expect(initialValue).to.be.equal(!initialValueForItems)

      res = await thirdPartyRegistryContract.setInitialItemValue(
        initialValueForItems,
        fromOwner
      )

      logs = res.logs

      expect(logs.length).to.be.equal(1)
      expect(logs[0].event).to.be.equal('InitialItemValueSet')
      expect(logs[0].args._oldInitialItemValue).to.be.equal(
        !initialValueForItems
      )
      expect(logs[0].args._newInitialItemValue).to.be.equal(
        initialValueForItems
      )

      initialValue = await thirdPartyRegistryContract.initialItemValue()
      expect(initialValue).to.be.equal(initialValueForItems)
    })

    it('reverts when trying to set the initial item value by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.setInitialItemValue(false, fromHacker),
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('addThirdParties', function () {
    it('should add third parties', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const { logs } = await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyAdded')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[0].args._managers).to.be.eql(thirdParty1[3])
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      expect(logs[1].event).to.be.equal('ThirdPartyAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(thirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(thirdParty2[2])
      expect(logs[1].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[1].args._managers).to.be.eql(thirdParty2[3])
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty1[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty1[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty2[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty2[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should add third parties :: Relayed EIP721', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(0)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'addThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[thirdParty1, thirdParty2]]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        committeeMember,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(committeeMember)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[1].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[1].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[1].args._managers).to.be.eql(thirdParty1[3])
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      expect(logs[2].event).to.be.equal('ThirdPartyAdded')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty2[0])
      expect(logs[2].args._metadata).to.be.eql(thirdParty2[1])
      expect(logs[2].args._resolver).to.be.eql(thirdParty2[2])
      expect(logs[2].args._isApproved).to.be.eql(initialValueForThirdParties)
      expect(logs[2].args._managers).to.be.eql(thirdParty2[3])
      expect(logs[2].args._caller).to.be.eql(committeeMember)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty1[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty1[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      for (let i = 0; i < thirdParty2[3].length; i++) {
        const isManager = await thirdPartyRegistryContract.isThirdPartyManager(
          thirdPartyId,
          thirdParty2[3][i]
        )
        expect(isManager).to.be.equal(true)
      }

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('reverts when trying to add third parties without id', async function () {
      const thirdPartyToBeAdded = [
        '',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromCommitteeMember
        ),
        'TPR#addThirdParties: EMPTY_ID'
      )
    })

    it('reverts when trying to add third parties without metadata', async function () {
      const thirdPartyToBeAdded = [
        'urn:decentraland:matic:ext-thirdparty1',
        '',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromCommitteeMember
        ),
        'TPR#addThirdParties: EMPTY_METADATA'
      )
    })

    it('reverts when trying to add third parties without resolver', async function () {
      const thirdPartyToBeAdded = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 1: the third party 1 desc',
        '',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromCommitteeMember
        ),
        'TPR#addThirdParties: EMPTY_RESOLVER'
      )
    })

    it('reverts when trying to add third parties without managers', async function () {
      const thirdPartyToBeAdded = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded],
          fromCommitteeMember
        ),
        'TPR#addThirdParties: EMPTY_MANAGERS'
      )
    })

    it('reverts when trying to repeat an id for a third parties', async function () {
      const thirdPartyToBeAdded1 = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      const thirdPartyToBeAdded2 = [
        'urn:decentraland:matic:ext-thirdparty1',
        'tp:1:third party 2: the third party 2 desc',
        'https://api.thirdparty2.com/v1/',
        [manager],
        [],
      ]

      await thirdPartyRegistryContract.addThirdParties(
        [thirdPartyToBeAdded1],
        fromCommitteeMember
      )

      await assertRevert(
        thirdPartyRegistryContract.addThirdParties(
          [thirdPartyToBeAdded2],
          fromCommitteeMember
        ),
        'TPR#addThirdParties: THIRD_PARTY_ALREADY_ADDED'
      )
    })

    it('reverts when trying to add a third party by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addThirdParties([thirdParty1], fromHacker),
        'TPR#onlyCommittee: CALLER_IS_NOT_A_COMMITTEE_MEMBER'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'addThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[thirdParty1]]
      )

      await assertRevert(
        sendMetaTx(
          thirdPartyRegistryContract,
          functionSignature,
          hacker,
          relayer,
          null,
          domain,
          version
        ),
        'NMT#executeMetaTransaction: CALL_FAILED'
      )
    })
  })

  describe('updateThirdParties', function () {
    let updatedThirdParty1
    let updatedThirdParty2
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromCommitteeMember
      )

      updatedThirdParty1 = [
        thirdParty1[0],
        'tp:1:updated third party 1: the third party 1 updated desc',
        'https://api.thirdparty1.com/v2/',
        [anotherManager],
        [true],
      ]

      updatedThirdParty2 = [
        thirdParty2[0],
        'tp:1:updated third party 2: the third party 2 desc updated',
        'https://api.thirdparty2.com/v2/',
        [],
        [],
      ]
    })

    it('should update third parties by a manager', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1, updatedThirdParty2],
        fromManager
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(manager)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[1].args._caller).to.be.eql(manager)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties by a committee member', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1, updatedThirdParty2],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[1].args._caller).to.be.eql(committeeMember)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: Relayed EIP721', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'updateThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[updatedThirdParty1, updatedThirdParty2]]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        manager,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(manager)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[1].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[1].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[1].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[1].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[1].args._caller).to.be.eql(manager)

      expect(logs[2].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[2].args._thirdPartyId).to.be.eql(updatedThirdParty2[0])
      expect(logs[2].args._metadata).to.be.eql(updatedThirdParty2[1])
      expect(logs[2].args._resolver).to.be.eql(updatedThirdParty2[2])
      expect(logs[2].args._managers).to.be.eql(updatedThirdParty2[3])
      expect(logs[2].args._managerValues).to.be.eql(updatedThirdParty2[4])
      expect(logs[2].args._caller).to.be.eql(manager)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      // Third Party 2
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(1)
      expect(thirdPartyId).to.be.eql(thirdParty2[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty2[0])

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty2[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty2[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty2[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: metadata', async function () {
      updatedThirdParty1 = [
        thirdParty1[0],
        'tp:1:updated third party 1: the third party 1 updated desc',
        '',
        [],
        [],
      ]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(updatedThirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(updatedThirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(false)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: resolver', async function () {
      updatedThirdParty1 = [
        thirdParty1[0],
        '',
        'https://api.thirdparty1.com/v2/',
        [],
        [],
      ]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(updatedThirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(updatedThirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(false)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should update third parties :: managers', async function () {
      updatedThirdParty1 = [thirdParty1[0], '', '', [anotherManager], [true]]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should empty third parties managers by committee member', async function () {
      updatedThirdParty1 = [thirdParty1[0], '', '', [manager], [false]]

      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      const { logs } = await thirdPartyRegistryContract.updateThirdParties(
        [updatedThirdParty1],
        fromCommitteeMember
      )

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(updatedThirdParty1[0])
      expect(logs[0].args._metadata).to.be.eql(thirdParty1[1])
      expect(logs[0].args._resolver).to.be.eql(thirdParty1[2])
      expect(logs[0].args._managers).to.be.eql(updatedThirdParty1[3])
      expect(logs[0].args._managerValues).to.be.eql(updatedThirdParty1[4])
      expect(logs[0].args._caller).to.be.eql(committeeMember)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(0)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(false)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        anotherManager
      )
      expect(isManager).to.be.equal(false)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('reverts when trying to update third parties without id', async function () {
      const thirdPartyToBeUpdated = [
        '',
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [true],
      ]

      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [thirdPartyToBeUpdated],
          fromManager
        ),
        'TPR#updateThirdParties: EMPTY_ID'
      )
    })

    it('reverts when manager mismatch', async function () {
      const thirdPartyToBeUpdated = [
        thirdParty1[0],
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [],
      ]

      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [thirdPartyToBeUpdated],
          fromManager
        ),
        'TPR#updateThirdParties: LENGTH_MISMATCH'
      )
    })

    it('reverts when a manager tries to be self-removed', async function () {
      const thirdPartyToBeUpdated = [
        thirdParty1[0],
        'tp:1:third party 1: the third party 1 desc',
        'https://api.thirdparty1.com/v1/',
        [manager],
        [false],
      ]

      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [thirdPartyToBeUpdated],
          fromManager
        ),
        'TPR#updateThirdParties: MANAGER_CANT_SELF_REMOVE'
      )
    })

    it('reverts when trying to update a third party by hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateThirdParties(
          [updatedThirdParty1],
          fromHacker
        ),
        'TPR#updateThirdParties: CALLER_IS_NOT_A_COMMITTEE_MEMBER_OR_MANAGER'
      )

      const functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'resolver',
                  type: 'string',
                },
                {
                  internalType: 'address[]',
                  name: 'managers',
                  type: 'address[]',
                },
                {
                  internalType: 'bool[]',
                  name: 'managerValues',
                  type: 'bool[]',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ThirdPartyParam[]',
              name: '_thirdParties',
              type: 'tuple[]',
            },
          ],
          name: 'updateThirdParties',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [[updatedThirdParty1, updatedThirdParty2]]
      )

      await assertRevert(
        sendMetaTx(
          thirdPartyRegistryContract,
          functionSignature,
          hacker,
          relayer,
          null,
          domain,
          version
        ),
        'NMT#executeMetaTransaction: CALL_FAILED'
      )
    })
  })

  describe('buyItemSlots', function () {
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromCommitteeMember
      )
    })

    it('should buy item slots by paying in acceptedToken', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      let fee = TIERS[0].price
      let value = TIERS[0].value
      let totalFee = fee
      let maxItemsExpected = TIERS[0].value

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        fee,
        fromUser
      )

      const slotsBuyer = await balanceSnap(manaContract, user, 'creator')
      const feeCollectorBalance = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

      let res = await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        0,
        fee,
        fromUser
      )
      let logs = res.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyItemsBought')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._price).to.be.eq.BN(fee)
      expect(logs[0].args._value).to.be.eq.BN(value)
      expect(logs[0].args._caller).to.be.eql(user)

      await slotsBuyer.requireDecrease(totalFee)
      await feeCollectorBalance.requireIncrease(totalFee)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      fee = TIERS[1].price
      value = TIERS[1].value
      totalFee = web3.utils.toBN(Number(totalFee) + Number(fee))
      maxItemsExpected += value

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        fee,
        fromUser
      )

      res = await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        1,
        fee,
        fromUser
      )
      logs = res.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyItemsBought')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._price).to.be.eq.BN(fee)
      expect(logs[0].args._value).to.be.eq.BN(value)
      expect(logs[0].args._caller).to.be.eql(user)

      await slotsBuyer.requireDecrease(totalFee)
      await feeCollectorBalance.requireIncrease(totalFee)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should buy item slots by paying in acceptedToken :: Relayed EIP721', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      let fee = TIERS[0].price
      let value = TIERS[0].value
      let totalFee = fee
      let maxItemsExpected = TIERS[0].value

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        fee,
        fromUser
      )

      const slotsBuyer = await balanceSnap(manaContract, user, 'creator')
      const feeCollectorBalance = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'uint256',
              name: '_tierIndex',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_price',
              type: 'uint256',
            },
          ],
          name: 'buyItemSlots',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], 0, fee]
      )

      let res = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        user,
        relayer,
        null,
        domain,
        version
      )
      let logs = res.logs

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyItemsBought')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._price).to.be.eq.BN(fee)
      expect(logs[1].args._value).to.be.eq.BN(value)
      expect(logs[1].args._caller).to.be.eql(user)

      await slotsBuyer.requireDecrease(totalFee)
      await feeCollectorBalance.requireIncrease(totalFee)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      fee = TIERS[1].price
      value = TIERS[1].value
      totalFee = web3.utils.toBN(Number(totalFee) + Number(fee))
      maxItemsExpected += value

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        fee,
        fromUser
      )

      functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              internalType: 'uint256',
              name: '_tierIndex',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_price',
              type: 'uint256',
            },
          ],
          name: 'buyItemSlots',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], 1, fee]
      )

      res = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        user,
        relayer,
        null,
        domain,
        version
      )
      logs = res.logs

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(user)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ThirdPartyItemsBought')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._price).to.be.eq.BN(fee)
      expect(logs[1].args._value).to.be.eq.BN(value)
      expect(logs[1].args._caller).to.be.eql(user)

      await slotsBuyer.requireDecrease(totalFee)
      await feeCollectorBalance.requireIncrease(totalFee)

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('should buy item slots for free', async function () {
      let thirdPartiesCount =
        await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      let fee = 0
      let value = TIERS[TIERS.length - 1].value
      let maxItemsExpected = TIERS[TIERS.length - 1].value

      await manaContract.approve(
        thirdPartyRegistryContract.address,
        fee,
        fromUser
      )

      const slotsBuyer = await balanceSnap(manaContract, user, 'creator')
      const feeCollectorBalance = await balanceSnap(
        manaContract,
        collector,
        'feeCollector'
      )

      let res = await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        TIERS.length - 1,
        fee,
        fromUser
      )
      let logs = res.logs

      expect(logs.length).to.be.equal(1)

      expect(logs[0].event).to.be.equal('ThirdPartyItemsBought')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._price).to.be.eq.BN(fee)
      expect(logs[0].args._value).to.be.eq.BN(value)
      expect(logs[0].args._caller).to.be.eql(user)

      await slotsBuyer.requireConstant()
      await feeCollectorBalance.requireConstant()

      thirdPartiesCount = await thirdPartyRegistryContract.thirdPartiesCount()
      expect(thirdPartiesCount).to.be.eq.BN(2)

      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(maxItemsExpected)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)
    })

    it('reverts when the third party is invalid', async function () {
      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0] + 'a',
          0,
          TIERS[0].price,
          fromUser
        ),
        'TPR#_checkThirdParty: INVALID_THIRD_PARTY'
      )
    })

    it('reverts when trying to buy item slots without approving accepted token', async function () {
      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          0,
          TIERS[0].price,
          fromUser
        )
      )
    })

    it('reverts when the sender has not balance', async function () {
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        TIERS[0].price,
        fromUser
      )

      const balance = await manaContract.balanceOf(user)
      await manaContract.transfer(hacker, balance, fromUser)

      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          0,
          TIERS[0].price,
          fromUser
        )
      )
    })

    it('reverts when trying to buy an invalid tier', async function () {
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        TIERS[0].price,
        fromUser
      )

      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          TIERS.length,
          TIERS[0].price,
          fromUser
        )
      )
    })

    it('reverts when trying price does not match', async function () {
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        TIERS[0].price,
        fromUser
      )

      await assertRevert(
        thirdPartyRegistryContract.buyItemSlots(
          thirdParty1[0],
          0,
          TIERS[1].price,
          fromUser
        ),
        'TPR#buyItems: PRICE_MISMATCH'
      )
    })
  })

  describe('addItems', function () {
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromCommitteeMember
      )

      // Buy 10 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        TIERS[0].price,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        0,
        TIERS[0].price,
        fromUser
      )
    })

    it('should add items', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(TIERS[0].value)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      const { logs } = await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ItemAdded')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[0][0])
      expect(logs[0].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[0][1])
      expect(logs[0].args._value).to.be.eql(initialValueForItems)
      expect(logs[0].args._caller).to.be.eql(manager)

      expect(logs[1].event).to.be.equal('ItemAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[1][0])
      expect(logs[1].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[1][1])
      expect(logs[1].args._value).to.be.eql(initialValueForItems)
      expect(logs[1].args._caller).to.be.eql(manager)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(TIERS[0].value)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should add items :: Relayed EIP721', async function () {
      // Third Party 1
      let thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      let thirdParty = await thirdPartyRegistryContract.thirdParties(
        thirdParty1[0]
      )

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(TIERS[0].value)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ItemParam[]',
              name: '_items',
              type: 'tuple[]',
            },
          ],
          name: 'addItems',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [thirdParty1[0], [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]]]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        manager,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(manager)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ItemAdded')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[0][0])
      expect(logs[1].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[0][1])
      expect(logs[1].args._value).to.be.eql(initialValueForItems)
      expect(logs[1].args._caller).to.be.eql(manager)

      expect(logs[2].event).to.be.equal('ItemAdded')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eq.BN(THIRD_PARTY_ITEMS[1][0])
      expect(logs[2].args._metadata).to.be.eq.BN(THIRD_PARTY_ITEMS[1][1])
      expect(logs[2].args._value).to.be.eql(initialValueForItems)
      expect(logs[2].args._caller).to.be.eql(manager)

      // Third Party 1
      thirdPartyId = await thirdPartyRegistryContract.thirdPartyIds(0)
      expect(thirdPartyId).to.be.eql(thirdParty1[0])

      thirdParty = await thirdPartyRegistryContract.thirdParties(thirdParty1[0])

      expect(thirdParty.metadata).to.be.eql(thirdParty1[1])
      expect(thirdParty.resolver).to.be.eql(thirdParty1[2])
      expect(thirdParty.isApproved).to.be.eql(initialValueForThirdParties)
      expect(thirdParty.maxItems).to.be.eq.BN(TIERS[0].value)
      expect(thirdParty.registered).to.be.eq.BN(1)

      let isManager = await thirdPartyRegistryContract.isThirdPartyManager(
        thirdParty1[0],
        manager
      )
      expect(isManager).to.be.equal(true)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should add the same item to another third party', async function () {
      // Buy 1000 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        TIERS[3].price,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty2[0],
        3,
        TIERS[3].price,
        fromUser
      )

      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(0)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(0)

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty2[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[2]],
        fromManager
      )

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty2[0])
      expect(itemsCount).to.be.eq.BN(2)

      let itemId = await thirdPartyRegistryContract.itemIdByIndex(
        thirdParty2[0],
        0
      )
      let item = await thirdPartyRegistryContract.itemsById(
        thirdParty2[0],
        itemId
      )

      expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[0][1])
      expect(item.contentHash).to.be.eql('')
      expect(item.isApproved).to.be.eql(initialValueForItems)
      expect(item.registered).to.be.eq.BN(1)

      itemId = await thirdPartyRegistryContract.itemIdByIndex(thirdParty2[0], 1)
      item = await thirdPartyRegistryContract.itemsById(thirdParty2[0], itemId)

      expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[2][1])
      expect(item.contentHash).to.be.eql('')
      expect(item.isApproved).to.be.eql(initialValueForItems)
      expect(item.registered).to.be.eq.BN(1)
    })

    it('add 50 items :: gas estimation', async function () {
      // Buy 1000 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        TIERS[3].price,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        3,
        TIERS[3].price,
        fromUser
      )

      const items = []
      for (let i = 0; i < 50; i++) {
        items.push([
          THIRD_PARTY_ITEMS[0][0] + i.toString(),
          THIRD_PARTY_ITEMS[0][1] + i.toString(),
        ])
      }

      const { receipt } = await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        items,
        fromManager
      )
      console.log(receipt.gasUsed)
    })

    it('reverts when trying to add an item by a hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
          fromHacker
        ),
        'TPR#addItems: INVALID_SENDER'
      )
    })

    it('reverts when trying to add an item when there is no slots available', async function () {
      for (let i = 0; i < TIERS[0].value; i++) {
        await thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [[THIRD_PARTY_ITEMS[0][0] + i, THIRD_PARTY_ITEMS[0][1]]],
          fromManager
        )
      }

      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
          fromManager
        ),
        'TPR#addItems: NO_ITEM_SLOTS_AVAILABLE'
      )
    })

    it('reverts when trying to add an item whith empty id', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [['', THIRD_PARTY_ITEMS[0][1]]],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_ID'
      )
    })

    it('reverts when trying to add an item whith empty metadata', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [[THIRD_PARTY_ITEMS[0][1], '']],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_METADATA'
      )
    })

    it('reverts when trying to add an item already added', async function () {
      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[0]],
          fromManager
        ),
        'TPR#addItems: ITEM_ALREADY_ADDED'
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0]],
        fromManager
      )

      await assertRevert(
        thirdPartyRegistryContract.addItems(
          thirdParty1[0],
          [THIRD_PARTY_ITEMS[0]],
          fromManager
        ),
        'TPR#addItems: ITEM_ALREADY_ADDED'
      )
    })
  })

  describe('updateItems', function () {
    let UPDATED_THIRD_PARTY_ITEMS
    beforeEach(async () => {
      await thirdPartyRegistryContract.addThirdParties(
        [thirdParty1, thirdParty2],
        fromCommitteeMember
      )

      // Buy 10 item slots
      await manaContract.approve(
        thirdPartyRegistryContract.address,
        TIERS[0].price,
        fromUser
      )
      await thirdPartyRegistryContract.buyItemSlots(
        thirdParty1[0],
        0,
        TIERS[0].price,
        fromUser
      )

      await thirdPartyRegistryContract.addItems(
        thirdParty1[0],
        [THIRD_PARTY_ITEMS[0], THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      UPDATED_THIRD_PARTY_ITEMS = [
        [THIRD_PARTY_ITEMS[0][0], THIRD_PARTY_ITEMS[0][1] + ' updated'],
        [THIRD_PARTY_ITEMS[1][0], THIRD_PARTY_ITEMS[1][1] + ' updated'],
      ]
    })

    it('should update items', async function () {
      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      const { logs } = await thirdPartyRegistryContract.updateItems(
        thirdParty1[0],
        [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
        fromManager
      )

      expect(logs.length).to.be.equal(2)

      expect(logs[0].event).to.be.equal('ItemUpdated')
      expect(logs[0].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[0].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[0][0])
      expect(logs[0].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[0][1]
      )
      expect(logs[0].args._caller).to.be.eql(manager)

      expect(logs[1].event).to.be.equal('ItemUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[1][0])
      expect(logs[1].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[1][1]
      )
      expect(logs[1].args._caller).to.be.eql(manager)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('should update items :: Relayed EIP721', async function () {
      let itemsCount = await thirdPartyRegistryContract.itemsCount(
        thirdParty1[0]
      )
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }

      let functionSignature = web3.eth.abi.encodeFunctionCall(
        {
          inputs: [
            {
              internalType: 'string',
              name: '_thirdPartyId',
              type: 'string',
            },
            {
              components: [
                {
                  internalType: 'string',
                  name: 'id',
                  type: 'string',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
              ],
              internalType: 'struct ThirdPartyRegistry.ItemParam[]',
              name: '_items',
              type: 'tuple[]',
            },
          ],
          name: 'updateItems',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        [
          thirdParty1[0],
          [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
        ]
      )

      const { logs } = await sendMetaTx(
        thirdPartyRegistryContract,
        functionSignature,
        manager,
        relayer,
        null,
        domain,
        version
      )

      expect(logs.length).to.be.equal(3)

      expect(logs[0].event).to.be.equal('MetaTransactionExecuted')
      expect(logs[0].args.userAddress).to.be.equal(manager)
      expect(logs[0].args.relayerAddress).to.be.equal(relayer)
      expect(logs[0].args.functionSignature).to.be.equal(functionSignature)

      expect(logs[1].event).to.be.equal('ItemUpdated')
      expect(logs[1].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[1].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[0][0])
      expect(logs[1].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[0][1]
      )
      expect(logs[1].args._caller).to.be.eql(manager)

      expect(logs[2].event).to.be.equal('ItemUpdated')
      expect(logs[2].args._thirdPartyId).to.be.eql(thirdParty1[0])
      expect(logs[2].args._itemId).to.be.eq.BN(UPDATED_THIRD_PARTY_ITEMS[1][0])
      expect(logs[2].args._metadata).to.be.eq.BN(
        UPDATED_THIRD_PARTY_ITEMS[1][1]
      )
      expect(logs[2].args._caller).to.be.eql(manager)

      itemsCount = await thirdPartyRegistryContract.itemsCount(thirdParty1[0])
      expect(itemsCount).to.be.eq.BN(2)

      for (let i = 0; i < itemsCount; i++) {
        const itemId = await thirdPartyRegistryContract.itemIdByIndex(
          thirdParty1[0],
          i
        )
        const item = await thirdPartyRegistryContract.itemsById(
          thirdParty1[0],
          itemId
        )

        expect(item.metadata).to.be.eql(UPDATED_THIRD_PARTY_ITEMS[i][1])
        expect(item.contentHash).to.be.eql('')
        expect(item.isApproved).to.be.eql(initialValueForItems)
        expect(item.registered).to.be.eq.BN(1)
      }
    })

    it('reverts when trying to update an item for an invalid third party', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0] + 'a',
          [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
          fromHacker
        ),
        'TPR#updateItems: INVALID_SENDER'
      )
    })

    it('reverts when trying to update an item by a hacker', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [UPDATED_THIRD_PARTY_ITEMS[0], UPDATED_THIRD_PARTY_ITEMS[1]],
          fromHacker
        ),
        'TPR#updateItems: INVALID_SENDER'
      )
    })

    it('reverts when trying to update an item with invalid id', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [
            [
              UPDATED_THIRD_PARTY_ITEMS[0][0] + 'a',
              UPDATED_THIRD_PARTY_ITEMS[0][1],
            ],
          ],
          fromManager
        ),
        'TPR#_checkItem: INVALID_ITEM'
      )

      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [['', UPDATED_THIRD_PARTY_ITEMS[0][1]]],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_ID'
      )
    })

    it('reverts when trying to update an item with invalid metadata', async function () {
      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [[UPDATED_THIRD_PARTY_ITEMS[0][0] + 'a', '']],
          fromManager
        ),
        'TPR#_checkItemParam: EMPTY_METADATA'
      )
    })

    it('reverts when trying to update an item already approved by a manager', async function () {
      await thirdPartyRegistryContract.reviewThirdParties(
        [
          [
            thirdParty1[0],
            true,
            [[...UPDATED_THIRD_PARTY_ITEMS[0], '0x12', true]],
          ],
        ],
        fromCommitteeMember
      )

      await assertRevert(
        thirdPartyRegistryContract.updateItems(
          thirdParty1[0],
          [UPDATED_THIRD_PARTY_ITEMS[0]],
          fromManager
        ),
        'TPR#updateItems: ITEM_IS_APPROVED'
      )
    })
  })
})
