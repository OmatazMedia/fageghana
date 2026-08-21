<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Member extends Model {
    protected $table = 'member_profiles';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id','contact_name','email','company_name','tier','status','membership_number','industry','country','phone'];
    protected static function boot() {
        parent::boot();
        static::creating(fn($m) => $m->id ??= \Illuminate\Support\Str::uuid()->toString());
    }
    public function user() { return $this->belongsTo(User::class); }
}
