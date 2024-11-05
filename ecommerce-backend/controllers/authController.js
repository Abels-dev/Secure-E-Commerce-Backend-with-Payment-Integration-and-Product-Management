import bcrypt from "bcrypt";
import crypto from "crypto";
import dotenv from "dotenv";
import {User} from "../models/user.js";
import {sendPasswordResetEmail,sendVerificationEmail,PasswordResetSuccessEmail,sendWelcomeEmail} from "../MailTrap/email.js";
import {generateTokenandsetCookie} from "../utils/jwt.js";
import {logger} from "../config/logger.js";
dotenv.config();


export const signup = async(req,res)=>{
    const {username,email,role,password} = req.body
    try {
        if(!username || !email){
            logger.info(" you should fill all the required requests")
            return res.status(400).json({message:"All fields are required!"})
        }
        const existingUser = await User.findOne({email})
        if(existingUser){
            logger.info(`user with ${email} is not found!`)
            return res.status(404).json({success:false,message:"user not found!"});
        }
        const hashed = await bcrypt.hash(password,10);
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString()
        const newUser = new User({
            username:username,
            email:email,
            password:hashed,
            role:role,
            verificationToken:verificationToken,
            verificationTokenExpiresAt:Date.now() + 24 * 60 * 60 * 1000
        })
        await newUser.save()
        await generateTokenandsetCookie(res,newUser._id);
        await sendWelcomeEmail(newUser.email)
        logger.info("you have sucessfully created Account,Welcome")
        return res.status(201).json({
            sucess:true,
            massage:"Account created Successfully!",
            user:{
                ...newUser._doc,
                password:undefined
            }
        })
   

    } catch (error) {
        throw Error(" failed to create Account!",error)
    }
};


export const verifyEmail = async(req,res)=>{
    const {code} = req.body
   try {
    const user = await User.find({
        verificationToken:code,
        verificationTokenExpiresAt:{$gt:Date.now()}
    })
    if(!user){
        logger.warn("please try again the code is invailid or it is expired!")
        return res.status(400).json({success: false, message: "Invalid or expired verification code" })
    }
    user.isverified = true,
    user.verificationToken = undefined
    user.verificationTokenExpiresAt = undefined
    await user.save()
    await sendVerificationEmail(user.email,user.username)
    logger.info(`user with email:${email} is verfied successfully`)
    res.status(200).json({
        success: true,
        message: "Email verified successfully",
        user: {
            ...user._doc,
            password: undefined,
        },
    });

   } catch (error) {
        logger.error("failed to verify the email due to unkown server error",{error:error.stack})
        return res.status(500).json({success: false, message: "Server error"} )
   }
}

export const login = async(req,res)=>{
    const {email,password} = req.body
    try {
        const user = await User.findOne({email});
        if(!user){
            return res.status(404).json({sucess:false,message:"user not found!"})
        }
        const passwordMatch = bcrypt.compare(password,user.password)
        if(!passwordMatch){
            return res.status(400).json({sucess:false,message:"Wrong Email or Password"})
        }
        await generateTokenandsetCookie(res,user._id)
        user.lastlogin = new Date();
        return res.status(200).json({
            sucess:true,
            message:"Loged in successFully",
            user:{
                ...user._doc,
                password:undefined
            },
        })
        
    } catch (error) {
        logger.error("failed to login due to unkown error",{stack:error.stack})
        return res.status(500).json({message:"server-error"})
    }
};



export const logOut = async (req,res) =>{
    res.clearCookie("token");
    return res.status(200).json({sucess:true,message:"you have successfully logged out!"})
}



export const forgotPassword = async(re,res)=>{
    const {email} = req.body
    try {
        const user = await User.findOne({email})
        if(!user){
            logger.info(`user not found with email${email}`)
            return res.status(404).json({sucess:true,message:"user not found!"})
        }
        const resetToken = crypto.randomBytes(20).toString('hex')
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000
        user.resetPasswordToken = resetToken
        user.resetPasswordExpiresAt = resetTokenExpiresAt

        await user.save();
        await sendPasswordResetEmail(user.email,`${process.env.CRYPTO_URL}\resetToken\ ${resetToken}`)
        logger.info("Email sent SuccessFully!")


        
    } catch (error) {
        logger.error("There is unknown error")
         res.status(500).json({sucess:false,message:"server-Error"})
        
    }

};


export const resetPasswoerd = async(req,res)=>{
    const {code} = req.body;
    const {password} = req.body
    try {
        const user = await User.find({
            resetPasswordToken:code,
            resetPasswordExpiresAt:{$gt:Date.now()}
        })
        if(!user){
            
            return res.status(400).json({success:false,message:"invalid Token"})
        }
        const hash = bcrypt.hash(password,10)
        user.password = hash
        user.resetPasswordToken=undefined
        user.resetPasswordExpiresAt = undefined
        await user.save();
        await PasswordResetSuccessEmail(user.email)
        return res.status(200).json({
            success:true,
            message:"password reseted succesfully!",
            user:{
                ...user._doc,
                password:undefined

            },
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({success:false,message:"server Error!"});
    }
}


