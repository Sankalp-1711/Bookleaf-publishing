import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Book, Ticket, User } from './models.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
dotenv.config({path:path.join(root,'.env'),override:false});
if(!process.env.MONGODB_URI){console.error('MONGODB_URI is required. Configure the root .env first.');process.exit(1);}
const source=JSON.parse(await readFile(path.join(root,'data','sample-authors.json'),'utf8'));
await mongoose.connect(process.env.MONGODB_URI);
try{
  const passwordHash=await bcrypt.hash('Bookleaf2026!',12);
  const demoAuthor=await User.findOneAndUpdate({email:'author@bookleaf.demo'},{$set:{name:'Sankalp Goyal',role:'AUTHOR'},$setOnInsert:{email:'author@bookleaf.demo',passwordHash}},{upsert:true,new:true});
  const admin=await User.findOneAndUpdate({email:'admin@bookleaf.demo'},{$set:{name:'Mira Kapoor',role:'ADMIN'},$setOnInsert:{email:'admin@bookleaf.demo',passwordHash}},{upsert:true,new:true});
  let demoBook=await Book.findOne({isbn:'978-93-91234-56-7',author:demoAuthor._id});
  if(!demoBook)demoBook=await Book.create({title:'The Quiet Between Pages',isbn:'978-93-91234-56-7',genre:'Literary fiction',publishedAt:new Date('2025-06-12'),status:'Published & live',mrp:399,royaltyPerCopy:42,copiesSold:186,royaltyEarned:24120,royaltyPaid:18000,royaltyPending:6120,printPartner:'In-House',availableOn:['Amazon India','Flipkart','BookLeaf Store'],author:demoAuthor._id});
  let demoTicket=await Ticket.findOne({subject:'Royalty statement clarification',author:demoAuthor._id});
  if(!demoTicket)await Ticket.create({subject:'Royalty statement clarification',description:'Hello, I would love to understand how my latest royalty amount was calculated. Could you share the breakdown?',author:demoAuthor._id,book:demoBook._id,category:'ROYALTY',priority:'MEDIUM',status:'IN_PROGRESS',assignee:admin._id,messages:[{body:'Hello, I would love to understand how my latest royalty amount was calculated. Could you share the breakdown?',sender:demoAuthor._id,isAdmin:false}]});
  let authorCount=0,bookCount=0;
  for(const sampleAuthor of source.authors){
    const author=await User.findOneAndUpdate({email:sampleAuthor.email.toLowerCase()},{$set:{sourceAuthorId:sampleAuthor.author_id,name:sampleAuthor.name,email:sampleAuthor.email.toLowerCase(),phone:sampleAuthor.phone,city:sampleAuthor.city,joinedDate:sampleAuthor.joined_date?new Date(sampleAuthor.joined_date):null,role:'AUTHOR'},$setOnInsert:{passwordHash}},{upsert:true,new:true,setDefaultsOnInsert:true});
    authorCount++;
    for(const sampleBook of sampleAuthor.books){
      const bookData={sourceBookId:sampleBook.book_id,title:sampleBook.title,isbn:sampleBook.isbn,genre:sampleBook.genre,publishedAt:sampleBook.publication_date?new Date(sampleBook.publication_date):null,status:sampleBook.status,mrp:sampleBook.mrp,royaltyPerCopy:sampleBook.author_royalty_per_copy,copiesSold:sampleBook.total_copies_sold,royaltyEarned:sampleBook.total_royalty_earned,royaltyPaid:sampleBook.royalty_paid,royaltyPending:sampleBook.royalty_pending,lastPayoutDate:sampleBook.last_royalty_payout_date?new Date(sampleBook.last_royalty_payout_date):null,printPartner:sampleBook.print_partner,availableOn:sampleBook.available_on,author:author._id};
      await Book.findOneAndUpdate({sourceBookId:sampleBook.book_id},{$set:bookData},{upsert:true,new:true,setDefaultsOnInsert:true});bookCount++;
    }
  }
  console.log(`Seed complete: ${authorCount} sample authors, ${bookCount} sample books, demo accounts, and one sample ticket.`);
  console.log('Password for seeded author accounts: Bookleaf2026!');
  console.log('Sample author login: priya.sharma@email.com');
  console.log('Demo author login: author@bookleaf.demo');
  console.log('Admin login: admin@bookleaf.demo');
}finally{await mongoose.disconnect();}
